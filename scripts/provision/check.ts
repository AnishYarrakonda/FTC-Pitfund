/*
 * npm run provision:check
 *
 * Read-only preflight: the CLIs are installed, the tokens in .env.provision are present and valid,
 * which accounts they belong to (loudly warns when one isn't the team account ftcexodius@gmail.com),
 * the GitHub org/repo access, and whether the domain is available or already owned.
 */
import { existsSync } from 'node:fs'

import { run, supabaseBin } from '../lib/proc'

import { apiClient, config, ENV_FILE, finish, getValue, GITHUB_REPO, heading, info, skip, TEAM_EMAIL, waitOn, warn } from './lib'
import { vercelScope } from './vercel-api'

function ok(text: string) {
  skip(text)
}

async function main() {
  heading('Files')
  if (existsSync(ENV_FILE)) ok(`${ENV_FILE} found`)
  else waitOn(`Copy .env.provision.example to ${ENV_FILE} and fill in the tokens (docs/LAUNCH.md step 2).`)

  heading('Command-line tools')
  for (const [name, bin, args] of [
    ['supabase', supabaseBin(), ['--version']],
    ['vercel (optional; the scripts use the REST API)', 'npx', ['--no-install', 'vercel', '--version']],
    ['gh', 'gh', ['--version']],
  ] as const) {
    const r = run(bin, [...args])
    if (r.code === 0) ok(`${name}: ${r.stdout.trim().split('\n').pop()}`)
    else if (name.startsWith('vercel')) info(`${name}: not installed`)
    else waitOn(`Install ${name} (${name === 'gh' ? 'https://cli.github.com' : 'npm install'}).`)
  }

  heading('GitHub')
  const gh = run('gh', ['api', 'user', '--jq', '.login'])
  if (gh.code !== 0) {
    waitOn('Sign in to GitHub: `gh auth login` (an owner of the ExodiusFTC org).')
  } else {
    const login = gh.stdout.trim()
    ok(`gh is signed in as ${login}`)
    const membership = run('gh', ['api', `orgs/ExodiusFTC/memberships/${login}`, '--jq', '.role'])
    if (membership.code !== 0) warn(`${login} is not a member of the ExodiusFTC org.`)
    else if (membership.stdout.trim() !== 'admin') warn(`${login} is an ExodiusFTC ${membership.stdout.trim()}, not an owner.`)
    else ok(`${login} owns the ExodiusFTC org`)
    const repo = run('gh', ['api', `repos/${GITHUB_REPO}`, '--jq', '.full_name'])
    if (repo.code === 0) ok(`repository ${repo.stdout.trim()} is reachable`)
    else warn(`Can't read ${GITHUB_REPO} with gh.`)
  }

  heading('Supabase')
  const supabaseToken = getValue('SUPABASE_ACCESS_TOKEN')
  if (!supabaseToken) {
    waitOn(`Add SUPABASE_ACCESS_TOKEN to ${ENV_FILE}.`)
  } else {
    const api = apiClient('https://api.supabase.com', { Authorization: `Bearer ${supabaseToken}` }, 'Supabase')
    const { data: profile } = await api<{ primary_email: string }>('GET', '/v1/profile')
    if (profile.primary_email.toLowerCase() === TEAM_EMAIL) ok(`token belongs to ${profile.primary_email}`)
    else warn(`SUPABASE TOKEN BELONGS TO ${profile.primary_email}, NOT ${TEAM_EMAIL}. Production must be owned by the team account.`)
    const { data: orgs } = await api<Array<{ name: string; slug: string }>>('GET', '/v1/organizations')
    const org = orgs.find((o) => o.slug === getValue('SUPABASE_ORG_SLUG') || o.name === config().supabaseOrg)
    if (org) ok(`organization "${org.name}" (${org.slug})`)
    else waitOn(`Create the Supabase organization "${config().supabaseOrg}" (docs/LAUNCH.md step 1).`)
  }

  heading('Vercel')
  if (!getValue('VERCEL_TOKEN')) {
    waitOn(`Add VERCEL_TOKEN to ${ENV_FILE}.`)
  } else {
    const { team, userEmail } = await vercelScope()
    if (userEmail?.toLowerCase() === TEAM_EMAIL) ok(`token belongs to ${userEmail}`)
    else warn(`VERCEL TOKEN BELONGS TO ${userEmail ?? 'an unknown account'}, NOT ${TEAM_EMAIL}. Production must be owned by the team account.`)
    ok(`team scope ${team.name} (${team.slug})`)
  }

  heading('Resend')
  const resendKey = getValue('RESEND_FULL_ACCESS_KEY')
  if (!resendKey) {
    waitOn(`Add RESEND_FULL_ACCESS_KEY (full access) to ${ENV_FILE}.`)
  } else {
    const api = apiClient('https://api.resend.com', { Authorization: `Bearer ${resendKey}` }, 'Resend')
    const { status, data } = await api<{ data?: Array<{ name: string }> }>('GET', '/domains', undefined, { allow: [401, 403] })
    if (status >= 400) warn('The Resend key is not a full-access key (it cannot list domains).')
    else ok(`Resend key works (${data.data?.length ?? 0} domains). Resend has no account-email API: confirm the key was created while signed in as ${TEAM_EMAIL}.`)
  }

  heading('Sentry (optional)')
  if (getValue('SENTRY_AUTH_TOKEN')) ok('SENTRY_AUTH_TOKEN present')
  else info('not configured (optional)')

  heading('Domain')
  const { domain } = config()
  if (!domain) {
    waitOn(`Buy the domain and set PITFUND_DOMAIN in ${ENV_FILE} (docs/LAUNCH.md step 3).`)
  } else if (getValue('VERCEL_TOKEN')) {
    const { api } = await vercelScope()
    const { status, data } = await api<{ available: boolean }>('GET', `/v1/registrar/domains/${domain}/availability`, undefined, { allow: [400, 403, 404] })
    if (status >= 400) info(`couldn't check availability of ${domain} (status ${status})`)
    else if (data.available) waitOn(`${domain} is still available: buy it (docs/LAUNCH.md step 3).`)
    else ok(`${domain} is registered (make sure it's yours)`)
    const dns = run('dig', ['+short', 'NS', domain])
    if (dns.code === 0 && dns.stdout.trim()) info(`nameservers: ${dns.stdout.trim().split('\n').join(', ')}`)
  }

  heading('Google OAuth (optional until launch)')
  if (getValue('GOOGLE_CLIENT_ID') && getValue('GOOGLE_CLIENT_SECRET')) ok('Google client id and secret present')
  else info('not yet (docs/LAUNCH.md step 5); email-code sign-in works without it')
}

main().then(
  () => finish('provision:check'),
  (e) => finish('provision:check', e),
)
