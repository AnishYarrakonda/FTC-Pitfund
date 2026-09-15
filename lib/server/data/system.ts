import 'server-only'

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { getDb } from '../db'
import { budgetFor, DAILY_EMAIL_LIMIT, WINDOW_MS } from '../email/outbox'
import { AppError } from '../result'
import { cronRuns, emailOutbox } from '../schema'

/*
 * /admin/system (prompt 3, scope D; plan §8–9): email quota, queued and failed email, storage and
 * database size against the free tiers, and the last run of each daily job. No charts.
 */

const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024
const DB_LIMIT_BYTES = 500 * 1024 * 1024
export const CRON_STALE_MS = 36 * 60 * 60 * 1000
const CRON_JOBS = ['drain-outbox', 'admin-digest', 'clean-staging', 'recheck-records', 'keepalive'] as const

export type SystemEmail = {
  id: string
  to: string
  template: string
  priority: number
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'bounced'
  attempts: number
  lastError: string | null
  sendAfter: Date
  createdAt: Date
  updatedAt: Date
  /** Queued rows: whether the quota has room at this priority right now. */
  canSendNow: boolean
}

type CronJobStatus = { job: string; startedAt: Date | null; finishedAt: Date | null; ok: boolean | null; detail: Record<string, unknown>; stale: boolean }

export type SystemStatus = {
  email: { used: number; limit: number; byPriority: Record<number, number>; queued: number; problems: number }
  queued: SystemEmail[]
  problems: SystemEmail[]
  storage: { usedBytes: number; limitBytes: number; files: number }
  database: { usedBytes: number; limitBytes: number }
  cron: CronJobStatus[]
}

const emailColumns = {
  id: emailOutbox.id,
  to: emailOutbox.toEmail,
  template: emailOutbox.template,
  priority: emailOutbox.priority,
  status: emailOutbox.status,
  attempts: emailOutbox.attempts,
  lastError: emailOutbox.lastError,
  sendAfter: emailOutbox.sendAfter,
  createdAt: emailOutbox.createdAt,
  updatedAt: emailOutbox.updatedAt,
}

export async function getSystemStatus(now = new Date()): Promise<SystemStatus> {
  const db = getDb()
  const windowStart = new Date(now.getTime() - WINDOW_MS)
  const [totalsResult, queued, problems, runs] = await Promise.all([
    db.execute<{ by_priority: Record<string, number> | null; sending: number; queued: number; problems: number; storage_bytes: string; files: number; db_bytes: string }>(sql`
      select
        (select json_object_agg(priority, n) from (select priority, count(*)::int as n from email_outbox where sent_at > ${windowStart.toISOString()}::timestamptz group by priority) p) as by_priority,
        (select count(*)::int from email_outbox where status = 'sending') as sending,
        (select count(*)::int from email_outbox where status in ('queued', 'sending')) as queued,
        (select count(*)::int from email_outbox where status in ('failed', 'bounced') and dismissed_at is null) as problems,
        (select coalesce(sum(coalesce(pdf_bytes, 0) + coalesce(pdf_thumb_bytes, 0) + coalesce(logo_bytes, 0)), 0) from teams)
          + (select coalesce(sum(coalesce(logo_bytes, 0)), 0) from sponsors) as storage_bytes,
        (select count(pdf_path) + count(pdf_thumb_path) + count(logo_path) from teams)::int
          + (select count(logo_path) from sponsors)::int as files,
        pg_database_size(current_database()) as db_bytes
    `),
    db.select(emailColumns).from(emailOutbox).where(inArray(emailOutbox.status, ['queued', 'sending'])).orderBy(asc(emailOutbox.priority), asc(emailOutbox.sendAfter)).limit(50),
    db
      .select(emailColumns)
      .from(emailOutbox)
      .where(and(inArray(emailOutbox.status, ['failed', 'bounced']), isNull(emailOutbox.dismissedAt)))
      .orderBy(desc(emailOutbox.updatedAt))
      .limit(50),
    db.execute<{ job: string; started_at: string; finished_at: string | null; ok: boolean | null; detail: Record<string, unknown> }>(sql`
      select distinct on (job) job, started_at, finished_at, ok, detail from ${cronRuns} order by job, started_at desc
    `),
  ])
  const totals = totalsResult[0]
  const byPriority = Object.fromEntries(Object.entries(totals.by_priority ?? {}).map(([k, v]) => [Number(k), Number(v)]))
  const used = Object.values(byPriority).reduce((a, b) => a + b, 0) + Number(totals.sending)
  const withSendNow = (row: (typeof queued)[number]): SystemEmail => ({ ...row, canSendNow: row.status === 'queued' && used < budgetFor(row.priority) })

  const byJob = new Map(runs.map((r) => [r.job, r]))
  const cron: CronJobStatus[] = [...new Set([...CRON_JOBS, ...byJob.keys()])].map((job) => {
    const r = byJob.get(job)
    const startedAt = r ? new Date(r.started_at) : null
    return {
      job,
      startedAt,
      finishedAt: r?.finished_at ? new Date(r.finished_at) : null,
      ok: r?.ok ?? null,
      detail: r?.detail ?? {},
      stale: !startedAt || now.getTime() - startedAt.getTime() > CRON_STALE_MS,
    }
  })

  return {
    email: { used, limit: DAILY_EMAIL_LIMIT, byPriority, queued: Number(totals.queued), problems: Number(totals.problems) },
    queued: queued.map(withSendNow),
    problems: problems.map((r) => ({ ...r, canSendNow: false })),
    storage: { usedBytes: Number(totals.storage_bytes), limitBytes: STORAGE_LIMIT_BYTES, files: Number(totals.files) },
    database: { usedBytes: Number(totals.db_bytes), limitBytes: DB_LIMIT_BYTES },
    cron,
  }
}

/** Put a failed or bounced email back in the queue. */
export async function requeueEmail(id: string, now = new Date()) {
  const [row] = await getDb()
    .update(emailOutbox)
    .set({ status: 'queued', attempts: 0, sendAfter: now, lastError: null, dismissedAt: null, updatedAt: now })
    .where(and(eq(emailOutbox.id, id), inArray(emailOutbox.status, ['failed', 'bounced'])))
    .returning({ id: emailOutbox.id, to: emailOutbox.toEmail })
  if (!row) throw new AppError('CONFLICT', 'That email isn’t failed anymore. Refresh to see its current state.')
  return row
}

export async function dismissEmail(id: string, now = new Date()) {
  const [row] = await getDb()
    .update(emailOutbox)
    .set({ dismissedAt: now })
    .where(and(eq(emailOutbox.id, id), inArray(emailOutbox.status, ['failed', 'bounced']), isNull(emailOutbox.dismissedAt)))
    .returning({ id: emailOutbox.id })
  if (!row) throw new AppError('CONFLICT', 'That email was already dismissed or retried.')
  return row
}

/** "Send now": make a queued email due immediately. The caller then sends it. */
export async function makeEmailDue(id: string, now = new Date()) {
  const [row] = await getDb()
    .update(emailOutbox)
    .set({ sendAfter: now, updatedAt: now })
    .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'queued')))
    .returning({ id: emailOutbox.id, to: emailOutbox.toEmail, priority: emailOutbox.priority })
  if (!row) throw new AppError('CONFLICT', 'That email isn’t queued anymore. Refresh to see its current state.')
  return row
}
