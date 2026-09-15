/*
 * npm run security:scan
 *
 * The security pass that needs a build and the local stack (prompt 4 §E). Exits 1 on any finding.
 *
 *   secrets     No server secret from .env.local (Supabase secret key, database URL and password,
 *               hook, cron and webhook secrets, Resend key) appears anywhere in `.next/` output
 *               that is served to browsers, or in any generated file outside the server bundle.
 *   rest        With the public (anon) key, Supabase REST returns nothing from any app table and
 *               refuses an insert: RLS is on with no policies and anon has no grants.
 *   dev         /dev, /dev/ui and /api/dev/sign-in are unreachable on the production build (:3100,
 *               built and started if needed).
 *   non-goals   No leftover of a removed v1 concept or plan §1 non-goal in app code.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { assertLocalStack, PROD_URL } from '../tests/support/env'

import { loadEnv } from './lib/env'
import { ensureProdServer, stopServer } from './lib/prod-server'

loadEnv()

const findings: string[] = []
const ok = (text: string) => console.log(`  ✓ ${text}`)
const bad = (text: string) => {
  findings.push(text)
  console.log(`  ✗ ${text}`)
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function secrets() {
  console.log('\n▸ Secrets in the build output')
  const names = ['SUPABASE_SECRET_KEY', 'DATABASE_URL', 'SEND_EMAIL_HOOK_SECRET', 'CRON_SECRET', 'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'RECEIPT_SECRET', 'SENTRY_AUTH_TOKEN']
  const values = new Map<string, string>()
  for (const name of names) {
    const v = process.env[name]
    if (v && v.length >= 12) values.set(name, v)
  }
  const db = process.env.DATABASE_URL
  if (db) {
    const password = decodeURIComponent(new URL(db.replace(/^postgres(ql)?:/, 'http:')).password)
    if (password.length >= 12) values.set('database password', password)
  }
  if (values.size === 0) return bad('no secrets found in .env.local to look for (run npm run setup)')

  // Browser-reachable output: static chunks, prerendered HTML/RSC payloads.
  const files = [...walk('.next/static'), ...walk('.next/server/app').filter((f) => /\.(html|rsc|body|meta|segments)$|\.segment\.rsc$/.test(f))]
  let hits = 0
  for (const file of files) {
    const text = readFileSync(file, 'latin1')
    for (const [name, value] of values) {
      if (text.includes(value)) {
        hits++
        bad(`${name} appears in ${file}`)
      }
    }
  }
  if (!hits) ok(`none of ${values.size} secrets appear in ${files.length} browser-reachable build files`)
}

async function rest() {
  console.log('\n▸ Supabase REST with the public key')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anon) return bad('NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE_KEY missing (run npm run setup)')
  const schema = readFileSync('lib/server/schema.ts', 'utf8')
  const tables = [...schema.matchAll(/pgTable\(\s*'([a-z_]+)'/g)].map((m) => m[1])
  const headers = { apikey: anon, Authorization: `Bearer ${anon}` }
  let exposed = 0
  for (const table of tables) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers })
    const body = await res.text()
    const rows = res.ok ? (JSON.parse(body) as unknown[]) : []
    if (res.ok && rows.length > 0) {
      exposed++
      bad(`anon can read ${table} (${rows.length} row)`)
    }
  }
  if (!exposed) ok(`anon reads nothing from ${tables.length} tables`)
  const insert = await fetch(`${url}/rest/v1/reports`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ reason: 'spam' }) })
  if (insert.ok) bad('anon could insert into reports')
  else ok(`anon insert refused (${insert.status})`)
}

async function dev() {
  console.log(`\n▸ Dev tools on the production build (${PROD_URL})`)
  for (const path of ['/dev', '/dev/ui', '/api/dev/sign-in?persona=admin']) {
    const res = await fetch(`${PROD_URL}${path}`, { redirect: 'manual' })
    const body = await res.text()
    // A soft 404 (streamed 200 with the 404 page and noindex) is also unreachable.
    const unreachable = res.status === 404 || (res.status === 200 && body.includes('noindex') && !body.includes('Personas'))
    if (unreachable) ok(`${path} → ${res.status}`)
    else bad(`${path} is reachable (${res.status})`)
  }
}

function nonGoals() {
  console.log('\n▸ Non-goals and v1 leftovers in app code')
  // Word-level patterns for removed v1 concepts and plan §1 non-goals. Legitimate uses are listed.
  const patterns: Array<[RegExp, string]> = [
    [/\bclerk\b/i, 'Clerk'],
    [/\bcapacity\b/i, 'capacity caps'],
    [/\bledger\b/i, 'ledger'],
    [/\bappeals?\b/i, 'appeals'],
    [/\bimpact report/i, 'impact reports'],
    [/\banalytics\b/i, 'analytics'],
    [/\b(owner|admin|member)Role\b|\brole: '(owner|manager)'/i, 'org roles'],
    [/\bSSO\b|\bsaml\b/i, 'SSO'],
    [/\bMFA\b|\btotp\b|two-factor/i, 'MFA'],
    [/\bsignInWithPassword\b|\bpassword:\s/i, 'password sign-in'],
    [/\bstripe\b|\bcheckout session\b/i, 'payments'],
    [/\bchat(room)?s?\b|\bmessages? thread/i, 'messaging'],
    [/\bdocusign\b|\be-?sign(ature)?\b/i, 'e-signatures'],
    [/\bdark:|prefers-color-scheme:\s*dark/i, 'dark mode'],
  ]
  // Mentions that deny the concept rather than build it.
  const allowed: Array<[string, RegExp]> = [
    ['app/(public)/legal/privacy/page.tsx', /We don’t use analytics/],
    ['app/api/auth/send-email/route.ts', /Everything else \(password\/email\/MFA notices\)/],
  ]
  const files = ['app', 'components', 'lib', 'proxy.ts'].flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p])).filter((f) => /\.(tsx?|css)$/.test(f))
  let hits = 0
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      for (const [re, label] of patterns) {
        if (re.test(line) && !allowed.some(([f, ok]) => f === file && ok.test(line))) {
          hits++
          bad(`${label}: ${file}:${i + 1}: ${line.trim().slice(0, 100)}`)
        }
      }
    })
  }
  if (!hits) ok(`no non-goal leftovers in ${files.length} files`)
}

async function main() {
  assertLocalStack()
  const server = await ensureProdServer(PROD_URL)
  try {
    secrets()
    await rest()
    await dev()
    nonGoals()
  } finally {
    stopServer(server)
  }
  if (findings.length) {
    console.error(`\n✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}`)
    process.exit(1)
  }
  console.log('\n✓ Security scan clean.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exit(1)
})
