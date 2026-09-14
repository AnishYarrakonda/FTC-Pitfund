import 'server-only'

import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { enqueueAdminDigest } from './digest'
import { getDb } from './db'
import { drainOutbox } from './email/outbox'
import type { EmailTransport } from './email/send'
import { recheckTeamRecord } from './data/admin-orgs'
import { reportUnexpected } from './result'
import { cronRuns, teams } from './schema'
import { BUCKETS, listStaleStagingObjects, removeObjects } from './storage'

/*
 * Scheduled work. Vercel Hobby allows one daily cron, so /api/cron/daily runs every job here in
 * sequence, each in its own try/catch, and records one cron_runs row per job (the admin System
 * page shows the latest of each). Every job is safe to run twice: the outbox claims rows with
 * SKIP LOCKED, the digest is deduplicated per admin per day, and the record check only touches
 * teams still `unchecked`. The final query also keeps the free Supabase project from pausing.
 */

const STAGING_TTL_MS = 24 * 60 * 60 * 1000
export const RECHECK_LIMIT = 20

type JobResult = { name: string; ok: boolean; result?: unknown; error?: string; reference?: string }

export type CronOptions = {
  now?: Date
  transport?: EmailTransport
  /** FIRST records lookups (tests inject a fake fetch). */
  fetch?: typeof fetch
  /** Skip the storage sweep (tests run without touching storage). */
  skipStorage?: boolean
}

async function job(name: string, run: () => Promise<unknown>, now: Date): Promise<JobResult> {
  const [row] = await getDb().insert(cronRuns).values({ job: name, startedAt: now }).returning({ id: cronRuns.id })
  let result: JobResult
  try {
    result = { name, ok: true, result: await run() }
  } catch (e) {
    result = { name, ok: false, error: e instanceof Error ? e.message : String(e), reference: reportUnexpected(e, { job: name }) }
  }
  await getDb()
    .update(cronRuns)
    .set({ finishedAt: new Date(), ok: result.ok, detail: JSON.parse(JSON.stringify(result.ok ? { result: result.result ?? null } : { error: result.error, reference: result.reference })) })
    .where(eq(cronRuns.id, row.id))
  return result
}

async function drainUntilDone(options: CronOptions) {
  const total = { claimed: 0, sent: 0, deferred: 0, retried: 0, failed: 0, rounds: 0 }
  // Keep going while a round sent something; stop when the queue is empty or the budget is gone.
  for (let round = 0; round < 10; round++) {
    const r = await drainOutbox({ limit: 100, now: options.now, transport: options.transport })
    total.rounds++
    total.claimed += r.claimed
    total.sent += r.sent
    total.deferred += r.deferred
    total.retried += r.retried
    total.failed += r.failed
    if (r.claimed === 0 || r.sent === 0) break
  }
  return total
}

export async function runDailyCron(options: CronOptions = {}) {
  const now = options.now ?? new Date()
  const step = (name: string, run: () => Promise<unknown>) => job(name, run, now)
  const results = [
    await step('drain-outbox', () => drainUntilDone(options)),
    await step('admin-digest', async () => {
      const digest = await enqueueAdminDigest(now)
      // Send it now if the budget allows (priority 3 stops at 70 sent).
      const drained = digest.skipped ? null : await drainOutbox({ now: options.now, transport: options.transport })
      return { ...digest, sent: drained?.sent ?? 0 }
    }),
    await step('clean-staging', async () => {
      if (options.skipStorage) return { deleted: 0, skipped: true }
      const stale = await listStaleStagingObjects(STAGING_TTL_MS, now)
      await removeObjects(BUCKETS.staging, stale)
      return { deleted: stale.length }
    }),
    await step('recheck-records', async () => {
      const unchecked = await getDb()
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.recordStatus, 'unchecked'), isNull(teams.suspendedAt)))
        .orderBy(asc(teams.createdAt))
        .limit(RECHECK_LIMIT)
      const outcomes = { matched: 0, not_found: 0, unavailable: 0 }
      for (const team of unchecked) {
        const { outcome } = await recheckTeamRecord(null, team.id, { fetch: options.fetch, now })
        outcomes[outcome]++
      }
      return { checked: unchecked.length, ...outcomes }
    }),
    await step('keepalive', async () => (await getDb().execute(sql`select 1 as ok`)).length),
  ]
  return { ok: results.every((r) => r.ok), results }
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
