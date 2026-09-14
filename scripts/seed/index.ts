/*
 * npm run seed -- --scenario demo|empty|edge
 *
 * Idempotent: every run wipes app data and storage, reconciles the @pitfund.test auth users
 * (persona ids are stable across runs, so signed-in sessions survive) and rebuilds the world.
 * Local stack only.
 */
import { closeDb } from '@/lib/server/db'

import { argValue, guardTarget, isLocalHost, loadEnv } from '../lib/env'

import { writePdfFixtures } from './pdf-fixtures'

loadEnv()

const SCENARIOS = ['demo', 'empty', 'edge'] as const
type Scenario = (typeof SCENARIOS)[number]

async function main() {
  const scenario = (argValue('scenario') ?? 'demo') as Scenario
  if (!SCENARIOS.includes(scenario)) {
    console.error(`Unknown scenario "${scenario}". Use one of: ${SCENARIOS.join(', ')}`)
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const databaseUrl = process.env.DATABASE_URL ?? ''
  if (!supabaseUrl || !databaseUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and DATABASE_URL must be set. Run `npm run setup`.')
    process.exit(1)
  }
  // Seeds create fake users and wipe data: never against anything but the local stack.
  if (!isLocalHost(supabaseUrl) || !isLocalHost(databaseUrl)) {
    console.error('Refusing to seed a non-local Supabase project or database.')
    process.exit(1)
  }
  guardTarget(databaseUrl, 'seed')

  const started = Date.now()
  const { run } = await import(`./scenarios/${scenario}.ts`)
  await run()
  await writePdfFixtures()
  await expireServerCaches()
  console.log(`✓ Seeded "${scenario}" in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

/** Running local servers keep `'use cache'` entries in memory; tell them the data changed. */
async function expireServerCaches() {
  const secret = process.env.CRON_SECRET
  if (!secret) return
  const servers = [process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000', process.env.QA_BASE_URL ?? 'http://127.0.0.1:3100']
  await Promise.all(
    servers.map((base) =>
      fetch(`${base}/api/revalidate`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(5000) }).catch(() => null),
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => closeDb())
