/*
 * npm run cron:run [-- --url http://127.0.0.1:3000]
 * Invoke the daily cron the way Vercel does: GET /api/cron/daily with `Authorization: Bearer
 * $CRON_SECRET`, against the running local app (default NEXT_PUBLIC_SITE_URL). Prints each job.
 */
import { argValue, loadEnv } from './lib/env'

loadEnv()

async function main() {
  const base = argValue('url') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set. Run `npm run setup` to write .env.local.')
    process.exit(1)
  }
  let res: Response
  try {
    res = await fetch(new URL('/api/cron/daily', base), { headers: { Authorization: `Bearer ${secret}` } })
  } catch {
    console.error(`Couldn't reach ${base}. Start the app with \`npm run dev\` first.`)
    process.exit(1)
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; results?: Array<{ name: string; ok: boolean; result?: unknown; error?: string }> } | null
  if (!body?.results) {
    console.error(`Cron responded ${res.status}: ${JSON.stringify(body)}`)
    process.exit(1)
  }
  for (const r of body.results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(16)} ${r.ok ? JSON.stringify(r.result) : r.error}`)
  }
  console.log(body.ok ? '✓ Daily cron finished' : '✗ Daily cron finished with failures')
  if (!body.ok) process.exitCode = 1
}

void main()
