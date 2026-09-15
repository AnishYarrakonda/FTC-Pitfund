/*
 * npm run provision:supabase [-- --dry-run] [--auth-only] [--only production|staging]
 *
 * Creates (or finds) the production and staging Supabase projects in the team org (us-east-1),
 * stores their keys and connection strings in .env.provision, applies the Drizzle migrations,
 * creates the storage buckets, pushes the auth settings (site URL, redirect URLs, 6-digit code,
 * Google when credentials exist, the Send Email hook), seeds staging with `demo` (never
 * production) and makes the ADMIN_EMAILS admins. Safe to run again at any point.
 */
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

import { runScript } from '../lib/proc'

import {
  apiClient,
  config,
  did,
  dryRun,
  fail,
  finish,
  flag,
  generatedValue,
  getValue,
  heading,
  hookSecret,
  info,
  plan,
  randomPassword,
  saveValue,
  skip,
  sleep,
  stagingSiteUrl,
  V1_DENY,
  waitOn,
  warn,
  type Api,
  type Stage,
} from './lib'
import { vercelScope, vercelToken } from './vercel-api'

type Project = { id: string; ref: string; name: string; region: string; status: string; organization_slug?: string }
type ApiKey = { id: string; name: string; type: 'legacy' | 'publishable' | 'secret' | null; api_key: string | null }
type PoolerConfig = { db_host: string; db_port: number; db_user: string; db_name: string; pool_mode: string; database_type: string }

const STAGES: Stage[] = ['production', 'staging']
const KEY = (stage: Stage, name: string) => `SUPABASE_${stage.toUpperCase()}_${name}`

export function managementApi(): Api {
  const token = getValue('SUPABASE_ACCESS_TOKEN')
  if (!token) fail('SUPABASE_ACCESS_TOKEN is missing from .env.provision (supabase.com → Account → Access Tokens).')
  return apiClient('https://api.supabase.com', { Authorization: `Bearer ${token}` }, 'Supabase')
}

export async function findOrg(api: Api) {
  const { data } = await api<Array<{ slug: string; name: string }>>('GET', '/v1/organizations')
  const wanted = getValue('SUPABASE_ORG_SLUG')
  const org = wanted ? data.find((o) => o.slug === wanted) : data.find((o) => o.name === config().supabaseOrg)
  if (!org) {
    fail(
      `No Supabase organization ${wanted ? `with slug "${wanted}"` : `named "${config().supabaseOrg}"`}. ` +
        `Create it at supabase.com/dashboard (docs/LAUNCH.md step 1). The token can see: ${data.map((o) => `${o.name} (${o.slug})`).join(', ') || 'none'}.`,
    )
  }
  return org
}

async function ensureProject(api: Api, orgSlug: string, stage: Stage): Promise<Project | null> {
  const name = config().supabaseProjects[stage]
  const { data: projects } = await api<Project[]>('GET', `/v1/organizations/${orgSlug}/projects`)
  const list = Array.isArray(projects) ? projects : ((projects as { projects?: Project[] }).projects ?? [])
  let project = list.find((p) => p.name === name) ?? null
  if (project && V1_DENY.supabaseRefs.includes(project.ref)) fail(`Refusing to use Supabase project ${project.ref}: that is v1.`)

  if (!project) {
    if (dryRun) {
      plan(`create Supabase project "${name}" in us-east-1`)
      return null
    }
    const dbPass = generatedValue(KEY(stage, 'DB_PASSWORD'), randomPassword)
    const { data } = await api<Project>('POST', '/v1/projects', {
      name,
      organization_slug: orgSlug,
      db_pass: dbPass,
      region_selection: { type: 'specific', code: 'us-east-1' },
    })
    project = data
    did(`created Supabase project "${name}" (${project.ref})`)
  } else {
    skip(`Supabase project "${name}" exists (${project.ref}, ${project.region})`)
    if (project.region !== 'us-east-1') warn(`"${name}" is in ${project.region}, not us-east-1 (Vercel runs in iad1).`)
  }
  saveValue(KEY(stage, 'REF'), project.ref)

  if (!getValue(KEY(stage, 'DB_PASSWORD'))) {
    waitOn(
      `The database password for existing project "${name}" isn't in .env.provision. Reset it in Supabase → Project Settings → Database, ` +
        `then add ${KEY(stage, 'DB_PASSWORD')}=… to .env.provision.`,
    )
    return null
  }

  for (let i = 0; project.status !== 'ACTIVE_HEALTHY'; i++) {
    if (i === 0) info(`waiting for "${name}" to come up (status ${project.status})…`)
    if (i > 60) fail(`"${name}" is still ${project.status} after 10 minutes. Check the Supabase dashboard.`)
    if (project.status === 'INACTIVE') fail(`"${name}" is paused. Restore it in the Supabase dashboard, then re-run.`)
    await sleep(10_000)
    project = (await api<Project>('GET', `/v1/projects/${project.ref}`)).data
  }
  return project
}

async function storeKeys(api: Api, project: Project, stage: Stage) {
  const { data: keys } = await api<ApiKey[]>('GET', `/v1/projects/${project.ref}/api-keys?reveal=true`)
  const find = (type: 'publishable' | 'secret') => keys.find((k) => k.type === type && k.api_key)
  for (const type of ['publishable', 'secret'] as const) {
    if (!find(type)) {
      if (dryRun) {
        plan(`create a ${type} API key for ${project.ref}`)
        continue
      }
      await api('POST', `/v1/projects/${project.ref}/api-keys?reveal=true`, { type, name: `pitfund_${type}` })
      did(`created ${type} API key for ${project.name}`)
    }
  }
  const fresh = (await api<ApiKey[]>('GET', `/v1/projects/${project.ref}/api-keys?reveal=true`)).data
  const publishable = fresh.find((k) => k.type === 'publishable')?.api_key
  const secret = fresh.find((k) => k.type === 'secret' && k.api_key)?.api_key
  if (!publishable || !secret) {
    if (!dryRun) fail(`Couldn't read the API keys of ${project.ref}.`)
    return
  }
  saveValue(KEY(stage, 'URL'), `https://${project.ref}.supabase.co`)
  saveValue(KEY(stage, 'PUBLISHABLE_KEY'), publishable)
  saveValue(KEY(stage, 'SECRET_KEY'), secret)

  // Connection strings from the pooler config: transaction mode (6543) for the app, session (5432) for migrations.
  const { data: poolers } = await api<PoolerConfig[]>('GET', `/v1/projects/${project.ref}/config/database/pooler`)
  const pooler = poolers.find((p) => p.database_type === 'PRIMARY') ?? poolers[0]
  if (!pooler) fail(`Supabase returned no pooler config for ${project.ref}.`)
  const password = encodeURIComponent(getValue(KEY(stage, 'DB_PASSWORD'))!)
  const user = pooler.db_user.includes('.') ? pooler.db_user : `postgres.${project.ref}`
  saveValue(KEY(stage, 'DATABASE_URL'), `postgresql://${user}:${password}@${pooler.db_host}:6543/${pooler.db_name}`)
  saveValue(KEY(stage, 'SESSION_DATABASE_URL'), `postgresql://${user}:${password}@${pooler.db_host}:5432/${pooler.db_name}`)
  generatedValue(KEY(stage, 'SEND_EMAIL_HOOK_SECRET'), hookSecret)
  did(`stored keys and connection strings for ${project.name}`)
}

function stageEnv(stage: Stage): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: getValue(KEY(stage, 'URL')),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: getValue(KEY(stage, 'PUBLISHABLE_KEY')),
    SUPABASE_SECRET_KEY: getValue(KEY(stage, 'SECRET_KEY')),
    DATABASE_URL: getValue(KEY(stage, 'SESSION_DATABASE_URL')),
    SEND_EMAIL_HOOK_SECRET: getValue(KEY(stage, 'SEND_EMAIL_HOOK_SECRET')),
    CONFIRM_REMOTE: '1',
    // Make sure no local .env.local value leaks into a remote run.
    CRON_SECRET: '',
  }
}

async function migrate(stage: Stage) {
  if (dryRun) return plan(`apply Drizzle migrations to ${stage}`)
  const code = await runScript('scripts/db-migrate.ts', ['--remote'], stageEnv(stage))
  if (code !== 0) fail(`Migrations failed on ${stage}.`)
  did(`migrations applied to ${stage}`)
}

const BUCKET_SETTINGS = {
  public: { public: true, fileSizeLimit: '10MB', allowedMimeTypes: ['application/pdf', 'image/webp', 'image/png', 'image/jpeg'] },
  staging: { public: false, fileSizeLimit: '10MB', allowedMimeTypes: ['application/pdf', 'image/*'] },
}

async function buckets(stage: Stage) {
  if (dryRun && !getValue(KEY(stage, 'SECRET_KEY'))) return plan(`create storage buckets public and staging on ${stage}`)
  const admin = createClient(getValue(KEY(stage, 'URL'))!, getValue(KEY(stage, 'SECRET_KEY'))!, { auth: { persistSession: false } })
  const { data: existing, error } = await admin.storage.listBuckets()
  if (error) fail(`Couldn't list buckets on ${stage}: ${error.message}`)
  for (const [id, settings] of Object.entries(BUCKET_SETTINGS)) {
    const found = existing.find((b) => b.id === id)
    const same =
      found &&
      found.public === settings.public &&
      JSON.stringify(found.allowed_mime_types ?? []) === JSON.stringify(settings.allowedMimeTypes) &&
      found.file_size_limit === 10 * 1024 * 1024
    if (same) {
      skip(`bucket "${id}" on ${stage} is configured`)
      continue
    }
    if (dryRun) {
      plan(`${found ? 'update' : 'create'} bucket "${id}" on ${stage}`)
      continue
    }
    const result = found ? await admin.storage.updateBucket(id, settings) : await admin.storage.createBucket(id, settings)
    if (result.error) fail(`Bucket "${id}" on ${stage}: ${result.error.message}`)
    did(`${found ? 'updated' : 'created'} bucket "${id}" on ${stage}`)
  }
}

async function authConfig(api: Api, stage: Stage) {
  const ref = getValue(KEY(stage, 'REF'))
  if (!ref) return plan(`push auth settings to ${stage} once the project exists`)
  const { domain, siteUrl, vercelProject, stagingBranch } = config()

  let site: string
  let redirects: string[]
  if (stage === 'production') {
    if (!siteUrl || !domain) {
      waitOn('Add PITFUND_DOMAIN=yourdomain.org to .env.provision (the domain you bought in docs/LAUNCH.md step 3).')
      return
    }
    site = siteUrl
    redirects = [`${siteUrl}/auth/callback`, `https://www.${domain}/auth/callback`]
  } else {
    if (!vercelToken()) {
      waitOn('Add VERCEL_TOKEN to .env.provision so staging can allow Vercel preview URLs.')
      return
    }
    const { team } = await vercelScope()
    site = stagingSiteUrl(vercelProject, team.slug, stagingBranch)
    redirects = [`${site}/auth/callback`, `https://${vercelProject}-*-${team.slug}.vercel.app/**`, 'http://127.0.0.1:3000/auth/callback']
    saveValue('STAGING_SITE_URL', site)
  }

  const googleId = getValue('GOOGLE_CLIENT_ID')
  const googleSecret = getValue('GOOGLE_CLIENT_SECRET')
  const bypass = stage === 'staging' ? getValue('VERCEL_AUTOMATION_BYPASS_SECRET') : undefined
  const hookUrl = `${site}/api/auth/send-email${bypass ? `?x-vercel-protection-bypass=${bypass}` : ''}`

  const desired: Record<string, unknown> = {
    site_url: site,
    uri_allow_list: redirects.join(','),
    disable_signup: false,
    external_email_enabled: true,
    mailer_autoconfirm: true,
    mailer_otp_exp: 600,
    mailer_otp_length: 6,
    smtp_max_frequency: 5,
    security_manual_linking_enabled: false,
    security_refresh_token_reuse_interval: 10,
    mfa_totp_enroll_enabled: false,
    mfa_totp_verify_enabled: false,
    hook_send_email_enabled: true,
    hook_send_email_uri: hookUrl,
    hook_send_email_secrets: getValue(KEY(stage, 'SEND_EMAIL_HOOK_SECRET')),
    external_google_enabled: Boolean(googleId && googleSecret),
    ...(googleId && googleSecret ? { external_google_client_id: googleId, external_google_secret: googleSecret } : {}),
  }

  const { data: current } = await api<Record<string, unknown>>('GET', `/v1/projects/${ref}/config/auth`)
  const changed = Object.entries(desired).filter(([k, v]) => k !== 'hook_send_email_secrets' && k !== 'external_google_secret' && current[k] !== v)
  const secretsDiffer = current.hook_send_email_secrets !== desired.hook_send_email_secrets
  if (changed.length === 0 && !secretsDiffer) {
    skip(`auth settings on ${stage} are current`)
  } else if (dryRun) {
    plan(`update auth settings on ${stage}: ${[...changed.map(([k]) => k), ...(secretsDiffer ? ['hook_send_email_secrets'] : [])].join(', ')}`)
  } else {
    await api('PATCH', `/v1/projects/${ref}/config/auth`, desired)
    did(`auth settings pushed to ${stage} (site ${site}, 6-digit codes, Send Email hook${googleId && googleSecret ? ', Google' : ''})`)
  }

  // Supabase's default limit on auth emails is low; the app has its own quota. Best effort: some
  // plans only allow raising it with custom SMTP.
  if (!dryRun && Number(current.rate_limit_email_sent ?? 0) < 100) {
    const { status } = await api('PATCH', `/v1/projects/${ref}/config/auth`, { rate_limit_email_sent: 100 }, { allow: [400, 403, 422] })
    if (status < 300) did(`auth email rate limit on ${stage} raised to 100/hour`)
    else warn(`Supabase didn't allow raising the auth email rate limit on ${stage} (status ${status}); codes may be limited per hour.`)
  }

  if (!googleId || !googleSecret) {
    info(`Google sign-in is off on ${stage}. Redirect URI for the Google OAuth client: https://${ref}.supabase.co/auth/v1/callback`)
    if (stage === 'production') {
      waitOn(
        'Google OAuth (docs/LAUNCH.md step 5): create the client with redirect URIs ' +
          `https://${ref}.supabase.co/auth/v1/callback${getValue(KEY('staging', 'REF')) ? ` and https://${getValue(KEY('staging', 'REF'))}.supabase.co/auth/v1/callback` : ''}, ` +
          'paste GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET into .env.provision, then run `npm run provision:supabase -- --auth-only` and `npm run provision:vercel`.',
      )
    }
  }
}

/** Seed staging with the demo scenario. Never production (the seed script refuses it too). */
async function seedStaging() {
  if (dryRun) return plan('seed staging with the demo scenario')
  const env = { ...stageEnv('staging'), PROVISION_STAGING_REF: getValue(KEY('staging', 'REF')), PROVISION_PRODUCTION_REF: getValue(KEY('production', 'REF')) }
  if (getValue('STAGING_SEEDED') === getValue(KEY('staging', 'REF')) && !flag('reseed')) {
    return skip('staging already seeded with demo (pass --reseed to reseed)')
  }
  const code = await runScript('scripts/seed/index.ts', ['--scenario', 'demo', '--remote', '--staging'], env)
  if (code !== 0) fail('Seeding staging failed.')
  saveValue('STAGING_SEEDED', getValue(KEY('staging', 'REF'))!)
  did('seeded staging with demo')
}

/**
 * Make ADMIN_EMAILS admins. An admin who has never signed in gets a confirmed auth user and a users
 * row first, so the grant works before their first sign-in (Google links to the same address).
 */
async function grantAdmins(stage: Stage) {
  const emails = config().adminEmails
  if (dryRun) return plan(`make ${emails.join(', ')} admin on ${stage}`)
  const admin = createClient(getValue(KEY(stage, 'URL'))!, getValue(KEY(stage, 'SECRET_KEY'))!, { auth: { persistSession: false } })
  const sql = postgres(getValue(KEY(stage, 'SESSION_DATABASE_URL'))!, { max: 1, prepare: false, onnotice: () => {} })
  try {
    for (const email of emails) {
      const [row] = await sql<Array<{ id: string; is_admin: boolean }>>`select id, is_admin from public.users where lower(email) = ${email}`
      if (row?.is_admin) {
        skip(`${email} is already an admin on ${stage}`)
        continue
      }
      let userId = row?.id
      if (!userId) {
        const [authRow] = await sql<Array<{ id: string }>>`select id from auth.users where lower(email) = ${email}`
        userId = authRow?.id
        if (!userId) {
          const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
          if (error || !data.user) fail(`Couldn't create the auth user for ${email} on ${stage}: ${error?.message}`)
          userId = data.user.id
        }
        await sql`insert into public.users (id, email) values (${userId}, ${email}) on conflict (id) do nothing`
      }
      const code = await runScript('scripts/admin-grant.ts', [email, '--remote'], stageEnv(stage))
      if (code !== 0) fail(`admin:grant failed for ${email} on ${stage}.`)
      did(`${email} is an admin on ${stage}`)
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

export async function provisionSupabase() {
  const api = managementApi()
  const only = process.argv.includes('--only') ? (process.argv[process.argv.indexOf('--only') + 1] as Stage) : null
  const stages = only ? STAGES.filter((s) => s === only) : STAGES
  const authOnly = flag('auth-only')

  heading('Supabase organization')
  const org = await findOrg(api)
  skip(`using organization "${org.name}" (${org.slug})`)

  for (const stage of stages) {
    heading(`Supabase ${stage}`)
    if (authOnly) {
      await authConfig(api, stage)
      continue
    }
    const project = await ensureProject(api, org.slug, stage)
    if (!project) continue
    await storeKeys(api, project, stage)
    if (dryRun && !getValue(KEY(stage, 'SECRET_KEY'))) continue
    await migrate(stage)
    await buckets(stage)
    await authConfig(api, stage)
    if (stage === 'staging') await seedStaging()
    await grantAdmins(stage)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  provisionSupabase().then(
    () => finish('provision:supabase'),
    (e) => finish('provision:supabase', e),
  )
}
