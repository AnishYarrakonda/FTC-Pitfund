/*
 * npm run provision:vercel [-- --dry-run] [--no-deploy]
 *
 * Creates (or finds) the Vercel project under the team account, connects the GitHub repo so pushes
 * to `main` deploy production, pins the function region to iad1, sets every environment variable for
 * production (prod Supabase) and preview (staging Supabase), generates PRODUCTION_CRON_SECRET, creates the
 * automation bypass the staging Send Email hook uses, creates the `staging` branch for the stable
 * preview alias, adds the domain and prints the DNS records it needs, and starts a production
 * deployment when the env changed. Never touches the v1 project.
 */
import { run } from '../lib/proc'

import {
  config,
  did,
  dryRun,
  fail,
  finish,
  flag,
  generatedValue,
  getValue,
  GITHUB_REPO,
  heading,
  info,
  plan,
  randomHex,
  report,
  saveValue,
  skip,
  stagingSiteUrl,
  waitOn,
  warn,
  type Stage,
} from './lib'
import { findProject, upsertEnv, vercelScope, warnIfNotTeamAccount, type EnvVar, type VercelProject } from './vercel-api'

const KEY = (stage: Stage, name: string) => `SUPABASE_${stage.toUpperCase()}_${name}`

async function ensureProject(): Promise<VercelProject | null> {
  const { api, team, userEmail } = await vercelScope()
  warnIfNotTeamAccount(userEmail)
  const name = config().vercelProject
  let project = await findProject()
  if (project) {
    skip(`Vercel project "${name}" exists in ${team.slug}`)
  } else if (dryRun) {
    plan(`create Vercel project "${name}" in ${team.slug} connected to ${GITHUB_REPO}`)
    return null
  } else {
    const body = { name, framework: 'nextjs', serverlessFunctionRegion: 'iad1', gitRepository: { type: 'github', repo: GITHUB_REPO } }
    const { status, data } = await api<VercelProject & { error?: { message?: string } }>('POST', '/v11/projects', body, { allow: [400, 403, 404] })
    if (status >= 400) {
      // Usually: the Vercel GitHub app isn't installed on the account that owns the repository yet.
      warn(`Vercel couldn't connect ${GITHUB_REPO}: ${data.error?.message ?? status}. Creating the project without Git.`)
      project = (await api<VercelProject>('POST', '/v11/projects', { name, framework: 'nextjs', serverlessFunctionRegion: 'iad1' })).data
    } else {
      project = data
    }
    did(`created Vercel project "${name}" (${project.id})`)
  }

  const linked = project.link?.type === 'github' && `${project.link.org}/${project.link.repo}`.toLowerCase() === GITHUB_REPO.toLowerCase()
  if (linked) {
    skip(`Git connected: pushes to ${project.link?.productionBranch ?? 'main'} deploy production`)
  } else if (project.link) {
    fail(`The project is connected to ${project.link.org}/${project.link.repo}, not ${GITHUB_REPO}. Fix that in Vercel → Settings → Git.`)
  } else {
    waitOn(
      `Connect GitHub: install the Vercel GitHub app on ${GITHUB_REPO.split('/')[0]} (github.com/apps/vercel → Configure → ` +
        `${GITHUB_REPO.split('/')[0]} → only select repositories → "${GITHUB_REPO.split('/')[1]}"), then re-run \`npm run provision:vercel\`.`,
    )
    if (!dryRun) {
      const { status } = await api('POST', `/v9/projects/${project.id}/link`, { type: 'github', repo: GITHUB_REPO }, { allow: [400, 403, 404] })
      if (status < 300) {
        report.waiting.pop()
        did(`connected ${GITHUB_REPO}`)
      }
    }
  }

  // autoExposeSystemEnvs: the ignored build step (scripts/vercel-ignore-build.mjs) skips any build that can't read
  // VERCEL_PROJECT_ID, which is how this repository stays off the v1 project that is still connected to it.
  if (project.serverlessFunctionRegion !== 'iad1' || project.ssoProtection?.deploymentType !== 'preview' || project.autoExposeSystemEnvs === false) {
    if (dryRun) plan('set function region iad1, protect previews with Vercel Authentication and expose system env vars to builds')
    else {
      await api('PATCH', `/v9/projects/${project.id}`, { serverlessFunctionRegion: 'iad1', ssoProtection: { deploymentType: 'preview' }, autoExposeSystemEnvs: true })
      did('function region iad1; previews require a Vercel login; system env vars exposed to builds')
    }
  } else {
    skip('function region iad1; previews protected; system env vars exposed to builds')
  }
  return project
}

/** The Send Email hook on staging calls a protected preview; it passes this bypass secret. */
async function ensureBypass(project: VercelProject) {
  const { api } = await vercelScope()
  const existing = Object.entries(project.protectionBypass ?? {}).find(([, v]) => v.scope === 'automation-bypass')?.[0]
  if (existing) {
    saveValue('VERCEL_AUTOMATION_BYPASS_SECRET', existing)
    return skip('automation bypass for the staging auth hook exists')
  }
  if (dryRun) return plan('create an automation bypass secret for the staging auth hook')
  const secret = randomHex(16)
  await api('PATCH', `/v1/projects/${project.id}/protection-bypass`, { generate: { secret, note: 'Supabase staging Send Email hook' } })
  saveValue('VERCEL_AUTOMATION_BYPASS_SECRET', secret)
  did('created an automation bypass for the staging auth hook (re-run provision:supabase -- --auth-only to use it)')
}

/** A long-lived `staging` branch gives previews a stable URL for the auth hook and email links. */
function ensureStagingBranch() {
  const branch = config().stagingBranch
  const exists = run('gh', ['api', `repos/${GITHUB_REPO}/branches/${branch}`, '--silent'])
  if (exists.code === 0) return skip(`branch "${branch}" exists on GitHub`)
  if (dryRun) return plan(`create branch "${branch}" from main on GitHub`)
  const sha = run('gh', ['api', `repos/${GITHUB_REPO}/git/ref/heads/main`, '--jq', '.object.sha'])
  if (sha.code !== 0) return warn(`Couldn't read main on ${GITHUB_REPO} with gh (${sha.stderr.trim()}). Create the "${branch}" branch by hand.`)
  const created = run('gh', ['api', `repos/${GITHUB_REPO}/git/refs`, '-f', `ref=refs/heads/${branch}`, '-f', `sha=${sha.stdout.trim()}`, '--silent'])
  if (created.code !== 0) return warn(`Couldn't create branch "${branch}": ${created.stderr.trim()}`)
  did(`created branch "${branch}" from main (its preview is the staging site)`)
}

function envVars(teamSlug: string): EnvVar[] {
  const { siteUrl, domain, vercelProject, stagingBranch } = config()
  const vars: EnvVar[] = []
  const both = (key: string, prod: string | undefined, preview: string | undefined, sensitive = false) => {
    if (prod) vars.push({ key, value: prod, targets: ['production'], sensitive })
    if (preview) vars.push({ key, value: preview, targets: ['preview'], sensitive })
  }
  const stage = (s: Stage, name: string) => getValue(KEY(s, name))
  const preview = stagingSiteUrl(vercelProject, teamSlug, stagingBranch)

  both('NEXT_PUBLIC_SITE_URL', siteUrl, preview)
  both('NEXT_PUBLIC_SUPABASE_URL', stage('production', 'URL'), stage('staging', 'URL'))
  both('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', stage('production', 'PUBLISHABLE_KEY'), stage('staging', 'PUBLISHABLE_KEY'))
  both('SUPABASE_SECRET_KEY', stage('production', 'SECRET_KEY'), stage('staging', 'SECRET_KEY'), true)
  both('DATABASE_URL', stage('production', 'DATABASE_URL'), stage('staging', 'DATABASE_URL'), true)
  both('SEND_EMAIL_HOOK_SECRET', stage('production', 'SEND_EMAIL_HOOK_SECRET'), stage('staging', 'SEND_EMAIL_HOOK_SECRET'), true)

  const cron = generatedValue('PRODUCTION_CRON_SECRET', () => randomHex(32))
  both('PRODUCTION_CRON_SECRET', cron, cron, true)

  const sendingKey = getValue('RESEND_SENDING_KEY')
  if (sendingKey && domain) {
    both('EMAIL_TRANSPORT', 'resend', 'resend')
    both('EMAIL_FROM', `FTC Pitfund <noreply@${domain}>`, `FTC Pitfund <noreply@${domain}>`)
    both('RESEND_API_KEY', sendingKey, sendingKey, true)
  }
  const webhook = getValue('RESEND_WEBHOOK_SECRET')
  both('RESEND_WEBHOOK_SECRET', webhook, webhook, true)

  for (const key of ['FIRST_API_USERNAME', 'FIRST_API_TOKEN']) {
    const value = getValue(key)
    both(key, value, value, key === 'FIRST_API_TOKEN')
  }
  return vars
}

async function domains(project: VercelProject) {
  const { api } = await vercelScope()
  const { domain } = config()
  if (!domain) return waitOn('Add PITFUND_DOMAIN to .env.local, then re-run `npm run provision:vercel`.')
  const { data } = await api<{ domains: Array<{ name: string; verified: boolean; redirect?: string | null }> }>('GET', `/v9/projects/${project.id}/domains`)
  const wanted = [
    { name: domain, redirect: undefined },
    { name: `www.${domain}`, redirect: domain },
  ]
  for (const d of wanted) {
    if (data.domains.some((x) => x.name === d.name)) {
      skip(`domain ${d.name} is on the project`)
    } else if (dryRun) {
      plan(`add domain ${d.name}${d.redirect ? ` (redirects to ${d.redirect})` : ''}`)
    } else {
      await api('POST', `/v10/projects/${project.id}/domains`, { name: d.name, ...(d.redirect ? { redirect: d.redirect, redirectStatusCode: 308 } : {}) })
      did(`added domain ${d.name}`)
    }
  }

  const records: string[] = []
  for (const d of wanted) {
    const { status, data: cfg } = await api<{ misconfigured: boolean; recommendedIPv4?: Array<{ rank: number; value: string[] }>; recommendedCNAME?: Array<{ rank: number; value: string }> }>(
      'GET',
      `/v6/domains/${d.name}/config?projectIdOrName=${project.id}`,
      undefined,
      { allow: [404] },
    )
    if (status === 404) continue
    if (!cfg.misconfigured) {
      skip(`DNS for ${d.name} points at Vercel`)
      continue
    }
    if (d.name === domain) {
      const ip = cfg.recommendedIPv4?.sort((a, b) => a.rank - b.rank)[0]?.value[0] ?? '76.76.21.21'
      records.push(`A     @     ${ip}`)
    } else {
      const cname = cfg.recommendedCNAME?.sort((a, b) => a.rank - b.rank)[0]?.value ?? 'cname.vercel-dns.com.'
      records.push(`CNAME www   ${cname}`)
    }
  }
  if (records.length) {
    info(`DNS records for ${domain} (at your registrar):`)
    for (const r of records) info(`  ${r}`)
    waitOn(`Add these DNS records for ${domain} at the registrar (docs/LAUNCH.md step 6): ${records.join(' · ')}`)
  }
}

async function deploy(project: VercelProject, envChanged: boolean) {
  const { api } = await vercelScope()
  if (flag('no-deploy')) return skip('deployment skipped (--no-deploy)')
  const { data } = await api<{ deployments: Array<{ uid: string; state?: string; readyState?: string; url: string }> }>('GET', `/v7/deployments?projectId=${project.id}&target=production&limit=1`)
  const latest = data.deployments[0]
  if (latest && !envChanged) return skip(`production deployment ${latest.url} (${latest.readyState ?? latest.state})`)
  if (!project.link?.repoId) {
    return info('No production deployment yet: it starts with the first push to main once GitHub is connected.')
  }
  if (dryRun) return plan('start a production deployment from main so the new environment applies')
  const { data: dep } = await api<{ url: string }>('POST', '/v13/deployments', {
    name: project.name,
    project: project.id,
    target: 'production',
    gitSource: { type: 'github', repoId: project.link.repoId, ref: 'main' },
  })
  did(`started a production deployment: https://${dep.url}`)
}

export async function provisionVercel() {
  heading('Vercel project')
  const { team } = await vercelScope()
  const project = await ensureProject()
  if (!project) {
    envVars(team.slug).forEach((v) => plan(`set ${v.key} for ${v.targets.join(', ')}`))
    return
  }
  await ensureBypass(project)
  ensureStagingBranch()

  heading('Environment variables')
  if (!getValue(KEY('production', 'URL'))) waitOn('Run `npm run provision:supabase` first: the Supabase values are not in .env.local yet.')
  const before = report.done.length
  await upsertEnv(project, envVars(team.slug))
  const envChanged = report.done.length > before

  heading('Domain')
  await domains(project)

  heading('Deployment')
  await deploy((await findProject()) ?? project, envChanged)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  provisionVercel().then(
    () => finish('provision:vercel'),
    (e) => finish('provision:vercel', e),
  )
}
