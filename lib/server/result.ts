import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { unstable_rethrow } from 'next/navigation'
import type { z } from 'zod'

import { err, ok, type ActionError, type ErrorCode, type Result } from '@/lib/shared/result'

export { err, ok }
export type { ActionError, ErrorCode, Result }

/**
 * Throw from anywhere inside an action or data function to return a typed error.
 * `defineAction` converts it into `{ ok: false, error }`.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly extra: Partial<ActionError> = {},
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (what = 'That page') => new AppError('NOT_FOUND', `${what} doesn't exist or you don't have access.`)

type PgError = { code?: string; constraint_name?: string; constraint?: string; detail?: string }

function pgErrorOf(e: unknown): PgError | undefined {
  let current: unknown = e
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as PgError & { cause?: unknown }
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) return candidate
    current = candidate.cause
  }
  return undefined
}

/**
 * Map a database error to an ActionError. Unique violations become CONFLICT with the
 * caller's human message (optionally chosen per constraint); anything else returns null so
 * the caller can rethrow it as unexpected.
 */
export function mapDbError(
  e: unknown,
  messages: { conflict?: string | Record<string, string>; notFound?: string } = {},
): ActionError | null {
  const pg = pgErrorOf(e)
  if (!pg) return null
  const constraint = pg.constraint_name ?? pg.constraint ?? ''
  if (pg.code === '23505') {
    const conflict = messages.conflict
    const message =
      typeof conflict === 'string'
        ? conflict
        : (conflict?.[constraint] ?? 'That already exists.')
    return { code: 'CONFLICT', message }
  }
  if (pg.code === '23503') {
    return { code: 'NOT_FOUND', message: messages.notFound ?? "Something this depends on doesn't exist anymore." }
  }
  if (pg.code === '23514' || pg.code === '22001') {
    return { code: 'VALIDATION', message: 'Some of what you entered is too long or not allowed.' }
  }
  if (pg.code === '57014' || pg.code === '53300' || pg.code === '08006' || pg.code === '08001') {
    return { code: 'UNAVAILABLE', message: 'FTC Pitfund is busy right now. Try again in a moment.' }
  }
  return null
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** Report an unexpected error and return a reference id the user can quote. */
export function reportUnexpected(e: unknown, context?: Record<string, unknown>): string {
  let reference = ''
  try {
    reference = Sentry.captureException(e, context ? { extra: context } : undefined) ?? ''
  } catch {
    // Sentry must never break a request.
  }
  if (!reference) reference = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  console.error(`[unexpected ${reference}]`, e)
  return reference
}

export function toActionError(e: unknown, messages?: Parameters<typeof mapDbError>[1]): ActionError {
  if (e instanceof AppError) return { code: e.code, message: e.message, ...e.extra }
  const mapped = mapDbError(e, messages)
  if (mapped) return mapped
  const reference = reportUnexpected(e)
  return {
    code: 'UNKNOWN',
    message: `Something went wrong on our side. Reference ${reference}.`,
    reference,
  }
}

type ActionOptions = { conflict?: string | Record<string, string> }

/**
 * The only way to write a server action:
 * zod validation → handler → Result. Never throws to the client (except Next's own
 * redirect/notFound signals, which are rethrown).
 */
export function defineAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>) => Promise<T>,
  options: ActionOptions = {},
): (input: z.input<S>) => Promise<Result<T>> {
  return async (input) => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = zodFieldErrors(parsed.error)
      const [field, message] = Object.entries(fieldErrors)[0] ?? ['_', 'Check the highlighted fields.']
      return {
        ok: false,
        error: { code: 'VALIDATION', message, field: field === '_' ? undefined : field, fieldErrors },
      }
    }
    try {
      return { ok: true, data: await handler(parsed.data) }
    } catch (e) {
      unstable_rethrow(e)
      return { ok: false, error: toActionError(e, options) }
    }
  }
}
