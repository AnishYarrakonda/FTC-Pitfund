/*
 * npm run provision:resend [-- --dry-run]
 *
 * Adds the sending domain to Resend and prints its DNS records (SPF, DKIM, plus a DMARC record),
 * asks Resend to verify it, creates the bounce/complaint webhook to /api/webhooks/resend, creates a
 * sending-only API key for the app, and stores the key and the webhook signing secret in
 * .env.provision and the Vercel env (production and preview).
 */
import { apiClient, config, did, dryRun, fail, finish, getValue, heading, info, plan, saveValue, skip, TEAM_EMAIL, waitOn, type Api } from './lib'
import { findProject, upsertEnv, vercelToken } from './vercel-api'

type Domain = { id: string; name: string; status: string; region: string; records?: Array<{ record: string; name: string; type: string; value: string; priority?: number; status: string }> }
type Webhook = { id: string; endpoint: string; events: string[]; status: string; signing_secret?: string }

const WEBHOOK_EVENTS = ['email.bounced', 'email.complained']

function resendApi(): Api {
  const key = getValue('RESEND_FULL_ACCESS_KEY')
  if (!key) fail('RESEND_FULL_ACCESS_KEY is missing from .env.provision (resend.com → API Keys).')
  return apiClient('https://api.resend.com', { Authorization: `Bearer ${key}` }, 'Resend')
}

async function ensureDomain(api: Api, domainName: string): Promise<Domain | null> {
  const { data } = await api<{ data: Domain[] }>('GET', '/domains')
  let domain = data.data.find((d) => d.name === domainName) ?? null
  if (!domain) {
    if (dryRun) {
      plan(`add sending domain ${domainName} (us-east-1)`)
      return null
    }
    domain = (await api<Domain>('POST', '/domains', { name: domainName, region: 'us-east-1' })).data
    did(`added sending domain ${domainName}`)
  } else {
    skip(`sending domain ${domainName} exists (${domain.status})`)
  }
  domain = (await api<Domain>('GET', `/domains/${domain.id}`)).data
  if (domain.status === 'verified') {
    skip(`${domainName} is verified`)
    return domain
  }

  info(`DNS records for sending email from ${domainName}:`)
  const lines = (domain.records ?? []).map((r) => `${r.type.padEnd(5)} ${r.name.padEnd(28)} ${r.value}${r.priority !== undefined ? ` (priority ${r.priority})` : ''}  [${r.record}: ${r.status}]`)
  lines.push(`TXT   _dmarc                       v=DMARC1; p=none; rua=mailto:${TEAM_EMAIL}`)
  for (const l of lines) info(`  ${l}`)
  if (!dryRun) {
    await api('POST', `/domains/${domain.id}/verify`, undefined, { allow: [400, 422] })
    info('asked Resend to check the records again')
  }
  waitOn(`Add the Resend DNS records above for ${domainName} (SPF, DKIM, DMARC), wait for them to verify, then re-run \`npm run provision:resend\`.`)
  return domain
}

async function ensureWebhook(api: Api, siteUrl: string) {
  const endpoint = `${siteUrl}/api/webhooks/resend`
  const { data } = await api<{ data: Webhook[] }>('GET', '/webhooks')
  let hook = data.data.find((w) => w.endpoint === endpoint)
  if (!hook) {
    if (dryRun) return plan(`create webhook ${endpoint} for ${WEBHOOK_EVENTS.join(', ')}`)
    hook = (await api<Webhook>('POST', '/webhooks', { endpoint, events: WEBHOOK_EVENTS })).data
    did(`created webhook ${endpoint}`)
  } else {
    skip(`webhook ${endpoint} exists`)
  }
  const secret = hook.signing_secret ?? (await api<Webhook>('GET', `/webhooks/${hook.id}`)).data.signing_secret
  if (!secret) fail(`Resend didn't return the signing secret for webhook ${hook.id}.`)
  if (getValue('RESEND_WEBHOOK_SECRET') !== secret) {
    saveValue('RESEND_WEBHOOK_SECRET', secret)
    did('stored the webhook signing secret')
  }
}

async function ensureSendingKey(api: Api, domain: Domain | null) {
  if (getValue('RESEND_SENDING_KEY')) return skip('sending-only API key for the app exists')
  if (dryRun || !domain) return plan('create a sending-only API key for the app')
  const { data } = await api<{ token: string }>('POST', '/api-keys', { name: 'ftc-pitfund-app', permission: 'sending_access', domain_id: domain.id })
  saveValue('RESEND_SENDING_KEY', data.token)
  did('created a sending-only API key (RESEND_SENDING_KEY)')
}

export async function provisionResend() {
  const api = resendApi()
  const { domain: domainName, siteUrl } = config()
  if (!domainName || !siteUrl) {
    waitOn('Add PITFUND_DOMAIN to .env.provision (docs/LAUNCH.md step 3), then re-run.')
    return
  }
  heading('Resend domain')
  const domain = await ensureDomain(api, domainName)
  heading('Resend webhook and API key')
  await ensureWebhook(api, siteUrl)
  await ensureSendingKey(api, domain)

  heading('Vercel env (email)')
  if (!vercelToken()) return waitOn('Add VERCEL_TOKEN so the email settings can be stored in Vercel, then re-run.')
  const project = await findProject()
  if (!project) return waitOn('Run `npm run provision:vercel` first to create the Vercel project, then re-run.')
  const key = getValue('RESEND_SENDING_KEY')
  const secret = getValue('RESEND_WEBHOOK_SECRET')
  const from = `FTC Pitfund <noreply@${domainName}>`
  const both = ['production', 'preview'] as const
  await upsertEnv(project, [
    ...(key
      ? [
          { key: 'RESEND_API_KEY', value: key, targets: [...both], sensitive: true },
          { key: 'EMAIL_TRANSPORT', value: 'resend', targets: [...both] },
          { key: 'EMAIL_FROM', value: from, targets: [...both] },
        ]
      : []),
    ...(secret ? [{ key: 'RESEND_WEBHOOK_SECRET', value: secret, targets: [...both], sensitive: true }] : []),
  ])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  provisionResend().then(
    () => finish('provision:resend'),
    (e) => finish('provision:resend', e),
  )
}
