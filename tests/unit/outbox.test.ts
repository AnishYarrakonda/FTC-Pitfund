import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/lib/server/db'
import {
  backoffMs,
  budgetFor,
  drainOutbox,
  enqueueEmail,
  markBounced,
  MAX_ATTEMPTS,
  quotaUsage,
  retryEmail,
  sendNow,
  WINDOW_MS,
} from '@/lib/server/email/outbox'
import { resendTransport, TransportError, type EmailTransport, type OutgoingEmail } from '@/lib/server/email/send'
import { emailOutbox } from '@/lib/server/schema'

import { dbTest } from './helpers/db'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => send(...args) }
  },
}))

/*
 * Outbox behavior with a fake clock and a fake transport (plan §5): quota budgets per
 * priority, deferral, retry and backoff, idempotency, terminal failures, bounces.
 */

const T0 = new Date('2031-03-10T12:00:00Z')
const at = (ms: number) => new Date(T0.getTime() + ms)
const MIN = 60_000
const HOUR = 60 * MIN

function fakeTransport(behavior: (email: OutgoingEmail, call: number) => void | Promise<void> = () => {}) {
  const sent: OutgoingEmail[] = []
  let calls = 0
  const transport: EmailTransport = {
    name: 'fake',
    async send(email) {
      calls++
      await behavior(email, calls)
      sent.push(email)
      return { providerId: `fake-${email.id}` }
    },
  }
  return { transport, sent, calls: () => calls }
}

const notice = (title = 'Hello') => ({ subject: title, title, paragraphs: ['Body'] })

async function fillSent(n: number, sentAt: Date) {
  if (n === 0) return
  await getDb()
    .insert(emailOutbox)
    .values(
      Array.from({ length: n }, (_, i) => ({
        toEmail: `filler${i}@pitfund.test`,
        template: 'notice',
        payload: notice(),
        priority: 1,
        status: 'sent' as const,
        attempts: 1,
        sentAt,
        sendAfter: sentAt,
      })),
    )
}

async function row(id: string) {
  const [r] = await getDb().select().from(emailOutbox).where(eq(emailOutbox.id, id))
  return r
}

// Tests own the outbox: clear it inside each rolled-back transaction.
const clean = () => getDb().delete(emailOutbox)

describe('outbox budgets', () => {
  it('budgets: auth 100, transactional/admin 90, digest 70', () => {
    expect([0, 1, 2, 3].map(budgetFor)).toEqual([100, 90, 90, 70])
  })

  it(
    'sends due rows in priority order through the transport, with the outbox id as idempotency key',
    dbTest(async () => {
      await clean()
      const fake = fakeTransport()
      const digest = await enqueueEmail({ to: 'a@pitfund.test', template: 'notice', data: notice('digest'), priority: 3, now: T0 })
      const auth = await enqueueEmail({ to: 'B@Pitfund.test', template: 'login-code', data: { code: '123456' }, priority: 0, now: T0 })
      const result = await drainOutbox({ now: T0, transport: fake.transport })

      expect(result).toMatchObject({ claimed: 2, sent: 2, deferred: 0, failed: 0 })
      expect(fake.sent.map((e) => e.id)).toEqual([auth.id, digest.id])
      expect(fake.sent[0]).toMatchObject({ to: 'b@pitfund.test', subject: '123456 is your FTC Pitfund sign-in code' })
      const authRow = await row(auth.id)
      expect(authRow).toMatchObject({ status: 'sent', attempts: 1, resendId: `fake-${auth.id}` })
      // The sign-in code is scrubbed once sent.
      expect(authRow.payload).toEqual({ redacted: true })
      expect((await row(digest.id)).payload).toMatchObject({ title: 'digest' })
    }),
  )

  it(
    'defers a transactional email at 90 sent, until the oldest send leaves the 24 h window',
    dbTest(async () => {
      await clean()
      await fillSent(1, at(-20 * HOUR))
      await fillSent(89, at(-1 * HOUR))
      const fake = fakeTransport()
      const queued = await enqueueEmail({ to: 'c@pitfund.test', template: 'notice', data: notice(), priority: 1, now: T0 })
      expect(queued.delayed).toBe(true)

      const result = await drainOutbox({ now: T0, transport: fake.transport })
      expect(result).toMatchObject({ sent: 0, deferred: 1 })
      expect(fake.calls()).toBe(0)
      const deferred = await row(queued.id)
      expect(deferred.status).toBe('queued')
      expect(deferred.sendAfter.getTime()).toBe(at(-20 * HOUR).getTime() + WINDOW_MS)

      // Not due before then…
      expect((await drainOutbox({ now: at(3 * HOUR), transport: fake.transport })).claimed).toBe(0)
      // …and sent once the oldest send has aged out.
      const later = await drainOutbox({ now: at(4 * HOUR + MIN), transport: fake.transport })
      expect(later).toMatchObject({ claimed: 1, sent: 1 })
    }),
  )

  it(
    'auth codes use the full 100 while digests stop at 70',
    dbTest(async () => {
      await clean()
      await fillSent(95, at(-2 * HOUR))
      const fake = fakeTransport()
      const digest = await enqueueEmail({ to: 'd@pitfund.test', template: 'notice', data: notice(), priority: 3, now: T0 })
      const admin = await enqueueEmail({ to: 'e@pitfund.test', template: 'notice', data: notice(), priority: 2, now: T0 })
      const auth = await enqueueEmail({ to: 'f@pitfund.test', template: 'login-code', data: { code: '654321' }, priority: 0, now: T0 })

      const result = await drainOutbox({ now: T0, transport: fake.transport })
      expect(result).toMatchObject({ claimed: 3, sent: 1, deferred: 2 })
      expect(fake.sent.map((e) => e.id)).toEqual([auth.id])
      expect((await row(digest.id)).status).toBe('queued')
      expect((await row(admin.id)).status).toBe('queued')
      expect((await quotaUsage(T0)).sentInWindow).toBe(96)
    }),
  )

  it(
    'stops auth at the hard limit of 100 and fails the code instead of delaying it',
    dbTest(async () => {
      await clean()
      await fillSent(100, at(-2 * HOUR))
      const fake = fakeTransport()
      const auth = await enqueueEmail({ to: 'g@pitfund.test', template: 'login-code', data: { code: '111111' }, priority: 0, now: T0 })
      expect(auth.delayed).toBe(true)
      expect(await sendNow(auth.id, { now: T0, transport: fake.transport })).toBe('failed')
      expect(fake.calls()).toBe(0)
      const failed = await row(auth.id)
      expect(failed.status).toBe('failed')
      expect(failed.payload).toEqual({ redacted: true })
    }),
  )
})

describe('outbox retries and failures', () => {
  it(
    'retries transient failures with exponential backoff, then fails after 5 attempts',
    dbTest(async () => {
      await clean()
      const fake = fakeTransport(() => {
        throw new TransportError('rate_limit_exceeded: slow down', 'transient', 429)
      })
      const email = await enqueueEmail({ to: 'h@pitfund.test', template: 'notice', data: notice(), priority: 1, now: T0 })

      let now = T0
      for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
        const result = await drainOutbox({ now, transport: fake.transport })
        expect(result).toMatchObject({ retried: 1 })
        const r = await row(email.id)
        expect(r).toMatchObject({ status: 'queued', attempts: attempt })
        expect(r.sendAfter.getTime() - now.getTime()).toBe(backoffMs(attempt))
        // Not due a millisecond early.
        expect((await drainOutbox({ now: new Date(r.sendAfter.getTime() - 1), transport: fake.transport })).claimed).toBe(0)
        now = r.sendAfter
      }
      expect(await drainOutbox({ now, transport: fake.transport })).toMatchObject({ failed: 1 })
      expect(await row(email.id)).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS })
      expect([1, 2, 3, 4].map(backoffMs)).toEqual([MIN, 2 * MIN, 4 * MIN, 8 * MIN])
    }),
  )

  it(
    'fails permanent (validation) errors immediately and can be retried from System',
    dbTest(async () => {
      await clean()
      let fail = true
      const fake = fakeTransport(() => {
        if (fail) throw new TransportError('validation_error: bad address', 'permanent', 422)
      })
      const email = await enqueueEmail({ to: 'i@pitfund.test', template: 'notice', data: notice(), priority: 1, now: T0 })
      expect(await drainOutbox({ now: T0, transport: fake.transport })).toMatchObject({ failed: 1, retried: 0 })
      expect(await row(email.id)).toMatchObject({ status: 'failed', attempts: 1, lastError: 'validation_error: bad address' })

      fail = false
      expect(await retryEmail(email.id, at(MIN))).toBe(true)
      expect(await drainOutbox({ now: at(MIN), transport: fake.transport })).toMatchObject({ sent: 1 })
    }),
  )

  it(
    'fails unknown templates and invalid payloads without calling the transport',
    dbTest(async () => {
      await clean()
      const fake = fakeTransport()
      const [bad] = await getDb()
        .insert(emailOutbox)
        .values({ toEmail: 'j@pitfund.test', template: 'does-not-exist', payload: {}, priority: 1, sendAfter: T0 })
        .returning()
      expect(await drainOutbox({ now: T0, transport: fake.transport })).toMatchObject({ failed: 1 })
      expect(fake.calls()).toBe(0)
      expect((await row(bad.id)).lastError).toContain('Unknown email template')
    }),
  )

  it(
    'dedupes by key so a double-click queues one email',
    dbTest(async () => {
      await clean()
      const first = await enqueueEmail({ to: 'k@pitfund.test', template: 'notice', data: notice(), priority: 1, dedupeKey: 'pitch:1:sent', now: T0 })
      const second = await enqueueEmail({ to: 'k@pitfund.test', template: 'notice', data: notice(), priority: 1, dedupeKey: 'pitch:1:sent', now: T0 })
      expect(second).toMatchObject({ id: first.id, deduped: true })
      expect(await getDb().select().from(emailOutbox)).toHaveLength(1)
    }),
  )

  it(
    'never double-sends: a claimed row is invisible to a concurrent drain, and stuck rows are reclaimed',
    dbTest(async () => {
      await clean()
      const fake = fakeTransport()
      const email = await enqueueEmail({ to: 'l@pitfund.test', template: 'notice', data: notice(), priority: 1, now: T0 })
      await getDb().update(emailOutbox).set({ status: 'sending', updatedAt: T0 }).where(eq(emailOutbox.id, email.id))
      expect((await drainOutbox({ now: at(MIN), transport: fake.transport })).claimed).toBe(0)
      // In-flight rows count against the quota.
      expect((await quotaUsage(at(MIN))).inFlight).toBe(1)
      // After 10 minutes a stuck row goes back to the queue and is sent once.
      expect(await drainOutbox({ now: at(11 * MIN), transport: fake.transport })).toMatchObject({ sent: 1 })
      expect(await drainOutbox({ now: at(12 * MIN), transport: fake.transport })).toMatchObject({ claimed: 0 })
      expect(fake.calls()).toBe(1)
    }),
  )

  it(
    'marks bounces and complaints from the webhook by provider id',
    dbTest(async () => {
      await clean()
      const fake = fakeTransport()
      const email = await enqueueEmail({ to: 'm@pitfund.test', template: 'notice', data: notice(), priority: 1, now: T0 })
      await drainOutbox({ now: T0, transport: fake.transport })
      expect(await markBounced(`fake-${email.id}`, 'bounced', 'Mailbox does not exist')).toBe(1)
      expect(await row(email.id)).toMatchObject({ status: 'bounced', lastError: 'bounced: Mailbox does not exist' })
      // Bounced mail was still sent, so it still counts toward the quota.
      expect((await quotaUsage(T0)).sentInWindow).toBe(1)
      expect(await markBounced('unknown-id', 'complained')).toBe(0)
    }),
  )
})

describe('resend transport (mocked Resend)', () => {
  beforeEach(() => {
    send.mockReset()
  })

  const email: OutgoingEmail = { id: 'outbox-1', to: 'n@pitfund.test', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' }

  it('passes the outbox id as the idempotency key', async () => {
    send.mockResolvedValue({ data: { id: 're_123' }, error: null })
    const result = await resendTransport('re_test', 'FTC Pitfund <noreply@pitfund.test>').send(email)
    expect(result).toEqual({ providerId: 're_123' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'n@pitfund.test', subject: 'Hi' }), { idempotencyKey: 'outbox-1' })
  })

  it.each([
    ['rate_limit_exceeded', 429, 'transient'],
    ['daily_quota_exceeded', 429, 'transient'],
    ['internal_server_error', 500, 'transient'],
    ['validation_error', 422, 'permanent'],
    ['invalid_from_address', 403, 'permanent'],
  ])('maps %s (%i) to a %s error', async (name, statusCode, kind) => {
    send.mockResolvedValue({ data: null, error: { name, statusCode, message: 'nope' } })
    await expect(resendTransport('re_test', 'x@pitfund.test').send(email)).rejects.toMatchObject({ kind, status: statusCode })
  })

  it('treats network errors and timeouts as transient', async () => {
    send.mockRejectedValueOnce(new Error('ECONNRESET'))
    await expect(resendTransport('re_test', 'x@pitfund.test').send(email)).rejects.toMatchObject({ kind: 'transient' })
    send.mockImplementationOnce(() => new Promise(() => {}))
    await expect(resendTransport('re_test', 'x@pitfund.test').send(email, { timeoutMs: 20 })).rejects.toMatchObject({ kind: 'transient' })
  })
})
