import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { getDb } from './db'
import { drainOutbox } from './email/outbox'
import { reportUnexpected } from './result'
import { cronRuns } from './schema'
import { BUCKETS, listStaleStagingObjects, removeObjects } from './storage'

/*
 * Scheduled work. Vercel Hobby allows one daily cron, so /api/cron/daily runs every job here
 * in sequence, each in its own try/catch, and records the run in cron_runs (shown on the admin
 * System page). The DB hit also keeps the free Supabase project from pausing.
 * Prompt 3 adds the admin digest and the unchecked-team recheck.
 */

const STAGING_TTL_MS = 24 * 60 * 60 * 1000

type JobResult = { name: string; ok: boolean; result?: unknown; error?: string; reference?: string }

async function job(name: string, run: () => Promise<unknown>): Promise<JobResult> {
  try {
    return { name, ok: true, result: await run() }
  } catch (e) {
    return { name, ok: false, error: e instanceof Error ? e.message : String(e), reference: reportUnexpected(e, { job: name }) }
  }
}

export async function runDailyCron() {
  const [run] = await getDb().insert(cronRuns).values({ job: 'daily' }).returning({ id: cronRuns.id })

  const results = [
    await job('keepalive', async () => (await getDb().execute(sql`select 1 as ok`)).length),
    await job('drain-outbox', () => drainOutbox({ limit: 100 })),
    await job('clean-staging', async () => {
      const stale = await listStaleStagingObjects(STAGING_TTL_MS)
      await removeObjects(BUCKETS.staging, stale)
      return { deleted: stale.length }
    }),
  ]

  const ok = results.every((r) => r.ok)
  await getDb()
    .update(cronRuns)
    .set({ finishedAt: new Date(), ok, detail: Object.fromEntries(results.map((r) => [r.name, r])) })
    .where(eq(cronRuns.id, run.id))
  return { ok, results }
}

export async function checkDatabase() {
  const started = Date.now()
  try {
    await getDb().execute(sql`select 1`)
    return { ok: true as const, latencyMs: Date.now() - started }
  } catch {
    return { ok: false as const, latencyMs: Date.now() - started }
  }
}
