import 'server-only'

import { and, asc, count, eq, gt, inArray, lte, min, notInArray } from 'drizzle-orm'

import { getDb, transaction } from '../db'
import { emailOutbox, type EmailOutboxRow } from '../schema'
import { getTransport, TransportError, type EmailTransport } from './send'
import { isSensitiveTemplate, renderEmail, TemplateError, type TemplateName, type TemplatePayload } from './templates'

/*
 * The email outbox (plan §5 "Email outbox"). Email is never sent inline from an action:
 * the action enqueues (usually inside its transaction) and schedules `after(drainOutbox)`.
 *
 * Quota: Resend free allows 100 emails per rolling 24 h. Budgets by priority —
 *   0 auth            may use all 100
 *   1 transactional   stops at 90
 *   2 admin instant   stops at 90
 *   3 digest          stops at 70
 * so sign-in codes always have headroom. Rows over budget wait until the oldest send in the
 * window ages out (`send_after = oldest_sent + 24h`). Transient failures back off
 * exponentially for up to 5 attempts; permanent failures fail immediately.
 */

export const DAILY_EMAIL_LIMIT = 100
export const WINDOW_MS = 24 * 60 * 60 * 1000
export const MAX_ATTEMPTS = 5
const STUCK_SENDING_MS = 10 * 60 * 1000

type EmailPriority = 0 | 1 | 2 | 3

export const PRIORITY = { auth: 0, transactional: 1, adminInstant: 2, digest: 3 } as const

export function budgetFor(priority: number) {
  if (priority <= 0) return 100
  if (priority <= 2) return 90
  return 70
}

/** Delay before retry number `attempts + 1`: 1, 2, 4, 8 minutes (capped at 1 hour). */
export function backoffMs(attempts: number) {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000)
}

type EnqueueInput<T extends TemplateName> = {
  to: string
  template: T
  data: TemplatePayload<T>
  priority: EmailPriority
  dedupeKey?: string
  sendAfter?: Date
  now?: Date
}

export type EnqueueResult = {
  id: string
  deduped: boolean
  /** True when the quota for this priority is exhausted, so delivery waits for the window. */
  delayed: boolean
}

export async function enqueueEmail<T extends TemplateName>(input: EnqueueInput<T>): Promise<EnqueueResult> {
  const now = input.now ?? new Date()
  const inserted = await getDb()
    .insert(emailOutbox)
    .values({
      toEmail: input.to.trim().toLowerCase(),
      template: input.template,
      payload: input.data as Record<string, unknown>,
      priority: input.priority,
      dedupeKey: input.dedupeKey ?? null,
      sendAfter: input.sendAfter ?? now,
    })
    .onConflictDoNothing({ target: emailOutbox.dedupeKey })
    .returning({ id: emailOutbox.id })

  const usage = await quotaUsage(now)
  const delayed = usage.used >= budgetFor(input.priority)

  if (inserted[0]) return { id: inserted[0].id, deduped: false, delayed }

  const existing = await getDb()
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(eq(emailOutbox.dedupeKey, input.dedupeKey!))
    .limit(1)
  return { id: existing[0]!.id, deduped: true, delayed }
}

export type QuotaUsage = {
  /** Emails sent in the rolling window plus emails currently being sent. */
  used: number
  sentInWindow: number
  inFlight: number
  oldestSentAt: Date | null
  limit: number
}

export async function quotaUsage(now = new Date(), excludeIds: string[] = []): Promise<QuotaUsage> {
  const windowStart = new Date(now.getTime() - WINDOW_MS)
  const [sent] = await getDb()
    .select({ n: count(), oldest: min(emailOutbox.sentAt) })
    .from(emailOutbox)
    .where(gt(emailOutbox.sentAt, windowStart))
  const [flying] = await getDb()
    .select({ n: count() })
    .from(emailOutbox)
    .where(
      and(
        eq(emailOutbox.status, 'sending'),
        excludeIds.length ? notInArray(emailOutbox.id, excludeIds) : undefined,
      ),
    )
  const sentInWindow = Number(sent?.n ?? 0)
  const inFlight = Number(flying?.n ?? 0)
  return {
    used: sentInWindow + inFlight,
    sentInWindow,
    inFlight,
    oldestSentAt: sent?.oldest ? new Date(sent.oldest) : null,
    limit: DAILY_EMAIL_LIMIT,
  }
}

export type DeliveryOutcome = 'sent' | 'deferred' | 'retry' | 'failed'

type DeliverOptions = {
  now: Date
  transport: EmailTransport
  usage: { used: number; oldestSentAt: Date | null }
  timeoutMs?: number
  /** Auth codes go stale, so they are never retried or deferred: they fail. */
  noRetry?: boolean
}

async function finish(row: EmailOutboxRow, patch: Partial<typeof emailOutbox.$inferInsert>) {
  const scrub = isSensitiveTemplate(row.template) && (patch.status === 'sent' || patch.status === 'failed')
  await getDb()
    .update(emailOutbox)
    .set({ ...patch, ...(scrub ? { payload: { redacted: true } } : {}) })
    .where(eq(emailOutbox.id, row.id))
}

async function deliver(row: EmailOutboxRow, options: DeliverOptions): Promise<DeliveryOutcome> {
  const { now, transport, usage } = options

  if (usage.used >= budgetFor(row.priority)) {
    if (options.noRetry) {
      await finish(row, { status: 'failed', lastError: 'Daily email limit reached', updatedAt: now })
      return 'failed'
    }
    const oldest = usage.oldestSentAt ?? now
    await finish(row, {
      status: 'queued',
      sendAfter: new Date(Math.max(oldest.getTime() + WINDOW_MS, now.getTime() + 60_000)),
      lastError: 'Waiting for the daily email limit to reset',
      updatedAt: now,
    })
    return 'deferred'
  }

  const attempts = row.attempts + 1
  try {
    const rendered = await renderEmail(row.template, row.payload)
    // Count the send before it happens so a concurrent row can't overshoot the budget.
    usage.used += 1
    const { providerId } = await transport.send(
      { id: row.id, to: row.toEmail, ...rendered },
      { timeoutMs: options.timeoutMs },
    )
    usage.oldestSentAt ??= now
    await finish(row, { status: 'sent', attempts, sentAt: now, resendId: providerId, lastError: null, updatedAt: now })
    return 'sent'
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 500) : String(e)
    if (!(e instanceof TemplateError)) usage.used -= 1
    const transient = e instanceof TransportError && e.kind === 'transient'
    if (!transient || options.noRetry || attempts >= MAX_ATTEMPTS) {
      await finish(row, { status: 'failed', attempts, lastError: message, updatedAt: now })
      return 'failed'
    }
    await finish(row, {
      status: 'queued',
      attempts,
      lastError: message,
      sendAfter: new Date(now.getTime() + backoffMs(attempts)),
      updatedAt: now,
    })
    return 'retry'
  }
}

export type DrainResult = { claimed: number; sent: number; deferred: number; retried: number; failed: number }

/**
 * Send whatever is due. Safe to run concurrently: rows are claimed with
 * FOR UPDATE SKIP LOCKED and flipped to `sending` before any network call.
 */
export async function drainOutbox(
  options: { now?: Date; limit?: number; transport?: EmailTransport } = {},
): Promise<DrainResult> {
  const now = options.now ?? new Date()
  const transport = options.transport ?? getTransport()
  const limit = options.limit ?? 50

  // A crashed drain can leave rows in `sending`; give them back to the queue.
  await getDb()
    .update(emailOutbox)
    .set({ status: 'queued', updatedAt: now })
    .where(
      and(eq(emailOutbox.status, 'sending'), lte(emailOutbox.updatedAt, new Date(now.getTime() - STUCK_SENDING_MS))),
    )

  const claimed = await transaction(async (tx) => {
    const due = await tx
      .select({ id: emailOutbox.id })
      .from(emailOutbox)
      .where(and(eq(emailOutbox.status, 'queued'), lte(emailOutbox.sendAfter, now)))
      .orderBy(asc(emailOutbox.priority), asc(emailOutbox.createdAt))
      .limit(limit)
      .for('update', { skipLocked: true })
    if (due.length === 0) return []
    return tx
      .update(emailOutbox)
      .set({ status: 'sending', updatedAt: now })
      .where(inArray(emailOutbox.id, due.map((r) => r.id)))
      .returning()
  })

  const result: DrainResult = { claimed: claimed.length, sent: 0, deferred: 0, retried: 0, failed: 0 }
  if (claimed.length === 0) return result

  claimed.sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime())
  const usage = await quotaUsage(now, claimed.map((r) => r.id))

  for (const row of claimed) {
    const outcome = await deliver(row, { now, transport, usage })
    if (outcome === 'sent') result.sent++
    else if (outcome === 'deferred') result.deferred++
    else if (outcome === 'retry') result.retried++
    else result.failed++
  }
  return result
}

/**
 * Send one row right now (the auth Send Email hook, which must answer within Supabase's
 * hook timeout). Auth codes are not retried: a late code is useless, so failure is terminal
 * and the caller tells the user to try again.
 */
export async function sendNow(
  id: string,
  options: { now?: Date; transport?: EmailTransport; timeoutMs?: number } = {},
): Promise<DeliveryOutcome> {
  const now = options.now ?? new Date()
  const [row] = await getDb()
    .update(emailOutbox)
    .set({ status: 'sending', updatedAt: now })
    .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'queued')))
    .returning()
  if (!row) return 'failed'
  const usage = await quotaUsage(now, [row.id])
  return deliver(row, {
    now,
    transport: options.transport ?? getTransport(),
    usage,
    timeoutMs: options.timeoutMs,
    noRetry: row.priority === PRIORITY.auth,
  })
}

/** Admin System page: put a failed email back in the queue. */
export async function retryEmail(id: string, now = new Date()) {
  const rows = await getDb()
    .update(emailOutbox)
    .set({ status: 'queued', attempts: 0, sendAfter: now, lastError: null, updatedAt: now })
    .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'failed')))
    .returning({ id: emailOutbox.id })
  return rows.length > 0
}

/** Resend webhook: mark a delivered email bounced or complained. */
export async function markBounced(providerId: string, reason: 'bounced' | 'complained', detail?: string) {
  const rows = await getDb()
    .update(emailOutbox)
    .set({ status: 'bounced', lastError: detail ? `${reason}: ${detail}`.slice(0, 500) : reason })
    .where(eq(emailOutbox.resendId, providerId))
    .returning({ id: emailOutbox.id })
  return rows.length
}
