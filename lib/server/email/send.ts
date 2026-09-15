import 'server-only'

import { createTransport, type Transporter } from 'nodemailer'
import { Resend } from 'resend'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'

import { env } from '../env'

/*
 * Transports. Production sends through Resend. Development sends to the local Mailpit over
 * SMTP (http://127.0.0.1:54324) unless RESEND_API_KEY is set AND EMAIL_TRANSPORT=resend.
 * Quota accounting lives in outbox.ts and is identical for both.
 */

export type OutgoingEmail = {
  /** outbox id; also the Resend idempotency key */
  id: string
  to: string
  subject: string
  html: string
  text: string
}

export type EmailTransport = {
  name: 'resend' | 'smtp' | 'fake'
  send(email: OutgoingEmail, options?: { timeoutMs?: number }): Promise<{ providerId: string | null }>
}

/** `transient` failures are retried with backoff; `permanent` ones fail immediately. */
export class TransportError extends Error {
  constructor(
    message: string,
    public readonly kind: 'transient' | 'permanent',
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'TransportError'
  }
}

const DEFAULT_TIMEOUT_MS = 10_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new TransportError(`Timed out after ${ms} ms`, 'transient')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolvePromise(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const TRANSIENT_RESEND_ERRORS = new Set([
  'rate_limit_exceeded',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
  'concurrent_idempotent_requests',
  'application_error',
  'internal_server_error',
])

export function resendTransport(apiKey: string, from: string): EmailTransport {
  const client = new Resend(apiKey)
  return {
    name: 'resend',
    async send(email, options) {
      let response: Awaited<ReturnType<typeof client.emails.send>>
      try {
        response = await withTimeout(
          client.emails.send(
            { from, to: email.to, subject: email.subject, html: email.html, text: email.text, replyTo: SUPPORT_EMAIL },
            { idempotencyKey: email.id },
          ),
          options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        )
      } catch (e) {
        if (e instanceof TransportError) throw e
        throw new TransportError(e instanceof Error ? e.message : 'Network error', 'transient')
      }
      if (response.error) {
        const status = response.error.statusCode ?? undefined
        const transient =
          TRANSIENT_RESEND_ERRORS.has(response.error.name) || status === 429 || (status !== undefined && status >= 500)
        throw new TransportError(`${response.error.name}: ${response.error.message}`, transient ? 'transient' : 'permanent', status)
      }
      return { providerId: response.data?.id ?? null }
    },
  }
}

export function smtpTransport(url: string, from: string): EmailTransport {
  let transporter: Transporter | undefined
  return {
    name: 'smtp',
    async send(email, options) {
      transporter ??= createTransport(url)
      try {
        const info = await withTimeout(
          transporter.sendMail({
            from,
            to: email.to,
            replyTo: SUPPORT_EMAIL,
            subject: email.subject,
            html: email.html,
            text: email.text,
            headers: { 'X-Pitfund-Outbox-Id': email.id },
          }),
          options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        )
        return { providerId: info.messageId ?? null }
      } catch (e) {
        if (e instanceof TransportError) throw e
        const responseCode = (e as { responseCode?: number }).responseCode
        const permanent = typeof responseCode === 'number' && responseCode >= 500 && responseCode < 600
        throw new TransportError(e instanceof Error ? e.message : 'SMTP error', permanent ? 'permanent' : 'transient', responseCode)
      }
    },
  }
}

let defaultTransport: EmailTransport | undefined

export function getTransport(): EmailTransport {
  if (!defaultTransport) {
    const e = env()
    defaultTransport =
      e.EMAIL_TRANSPORT === 'resend' && e.RESEND_API_KEY
        ? resendTransport(e.RESEND_API_KEY, e.EMAIL_FROM)
        : smtpTransport(e.SMTP_URL, e.EMAIL_FROM)
  }
  return defaultTransport
}
