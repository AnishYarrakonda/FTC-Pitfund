/*
 * npm run provision:verify [-- --url https://staging-alias.vercel.app --stage staging]
 *
 * Production smoke test, read-mostly. Checks: /api/health, the landing page, /login offers both
 * sign-in methods, security headers, /dev and /api/dev/sign-in are 404, robots and sitemap, the
 * cron endpoint refuses a missing secret and runs with it, and a test email to the team inbox
 * goes through the outbox (queued with a unique key, drained by the cron run, then marked sent).
 */
import { randomUUID } from 'node:crypto'

import postgres from 'postgres'

import { argValue } from '../lib/env'

import { config, did, fail, finish, getValue, heading, info, ownerEmail, waitOn, warn, type Stage } from './lib'

let failures = 0
function check(ok: boolean, text: string, detail?: string) {
  if (ok) did(text)
  else {
    failures++
    warn(`FAILED: ${text}${detail ? ` (${detail})` : ''}`)
  }
}

async function get(base: string, path: string, init?: RequestInit) {
  try {
    const res = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(30_000), ...init })
    return { status: res.status, headers: res.headers, text: await res.text() }
  } catch (e) {
    return { status: 0, headers: new Headers(), text: e instanceof Error ? e.message : String(e) }
  }
}

async function main() {
  const stage = (argValue('stage') ?? 'production') as Stage
  const base = argValue('url') ?? (stage === 'production' ? config().siteUrl : getValue('STAGING_SITE_URL'))
  if (!base) fail('No site URL: set PITFUND_DOMAIN in .env.local or pass --url.')
  heading(`Smoke test ${base}`)

  const health = await get(base, '/api/health')
  check(health.status === 200 && health.text.includes('"ok":true'), '/api/health answers and the database is up', `${health.status} ${health.text.slice(0, 120)}`)

  const landing = await get(base, '/')
  check(landing.status === 200 && landing.text.includes('Sponsorship pitches companies actually read'), 'landing page renders', `status ${landing.status}`)
  for (const header of ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
    check(landing.headers.has(header), `security header ${header}`)
  }

  const login = await get(base, '/login')
  check(login.status === 200 && login.text.includes('Email me a code'), '/login offers the email code', `status ${login.status}`)

  for (const path of ['/dev', '/dev/ui', '/api/dev/sign-in?persona=admin']) {
    const res = await get(base, path)
    check(res.status === 404 || (res.status === 200 && res.text.includes('noindex') && !res.text.includes('Personas')), `${path} is not reachable`, `status ${res.status}`)
  }

  const robots = await get(base, '/robots.txt')
  check(robots.status === 200 && robots.text.includes('Disallow: /admin'), 'robots.txt disallows /admin')
  const sitemap = await get(base, '/sitemap.xml')
  check(sitemap.status === 200 && sitemap.text.includes('<urlset'), 'sitemap.xml renders')

  heading('Cron and email')
  const cronSecret = getValue('PRODUCTION_CRON_SECRET')
  const refused = await get(base, '/api/cron/daily')
  check(refused.status === 401, 'cron refuses a request without the secret', `status ${refused.status}`)

  const dbUrl = getValue(`SUPABASE_${stage.toUpperCase()}_SESSION_DATABASE_URL`)
  let outboxId: string | null = null
  const sql = dbUrl ? postgres(dbUrl, { max: 1, prepare: false, onnotice: () => {} }) : null
  try {
    if (sql) {
      const key = `provision-verify:${new Date().toISOString().slice(0, 10)}:${randomUUID()}`
      const [row] = await sql<Array<{ id: string }>>`
        insert into public.email_outbox (to_email, template, payload, priority, dedupe_key, send_after)
        values (${ownerEmail()}, 'notice', ${sql.json({
          subject: 'FTC Pitfund is live: test email',
          title: 'Email delivery works',
          paragraphs: [`This test was queued by npm run provision:verify at ${new Date().toISOString()} and sent by the daily job.`],
          cta: { label: 'Open FTC Pitfund', href: base },
        })}, 2, ${key}, now())
        returning id`
      outboxId = row.id
      info(`queued a test email to ${ownerEmail()} (outbox ${outboxId})`)
    } else {
      warn('No database URL in .env.local: skipping the outbox email test.')
    }

    if (!cronSecret) {
      waitOn('PRODUCTION_CRON_SECRET is not in .env.local: run `npm run provision:vercel` first.')
    } else {
      const cron = await get(base, '/api/cron/daily', { headers: { Authorization: `Bearer ${cronSecret}` } })
      check(cron.status === 200 && cron.text.includes('"ok":true'), 'cron runs with the secret and every job succeeds', `${cron.status} ${cron.text.slice(0, 200)}`)
    }

    if (sql && outboxId) {
      let status = 'queued'
      for (let i = 0; i < 10 && status !== 'sent' && status !== 'failed'; i++) {
        const [row] = await sql<Array<{ status: string; last_error: string | null }>>`select status, last_error from public.email_outbox where id = ${outboxId}`
        status = row.status
        if (status !== 'sent') await new Promise((r) => setTimeout(r, 3000))
      }
      check(status === 'sent', `test email to ${ownerEmail()} was sent through the outbox`, `status ${status}`)
      if (status === 'sent') info(`check the ${ownerEmail()} inbox for "FTC Pitfund is live: test email"`)
    }
  } finally {
    await sql?.end({ timeout: 5 })
  }

  if (failures) fail(`${failures} check${failures === 1 ? '' : 's'} failed`)
}

main().then(
  () => finish('provision:verify'),
  (e) => finish('provision:verify', e),
)
