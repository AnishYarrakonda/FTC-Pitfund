/*
 * The contract between server actions and the UI (plan §3.1 #2). Shared so client code can
 * branch on `code` without importing anything server-only.
 */

export const ERROR_CODES = [
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'UNKNOWN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ActionError = {
  code: ErrorCode
  /** Written for humans. Safe to render as-is. */
  message: string
  /** The form field this error belongs to, when there is one. */
  field?: string
  /** Every field error from validation, keyed by field path. */
  fieldErrors?: Record<string, string>
  /** Sentry event id (or a local reference) for unexpected errors. */
  reference?: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ActionError }

export function ok<T>(data: T): Result<T>
export function ok(): Result<void>
export function ok<T>(data?: T): Result<T | void> {
  return { ok: true, data }
}

export function err(code: ErrorCode, message: string, extra: Partial<ActionError> = {}): Result<never> {
  return { ok: false, error: { code, message, ...extra } }
}

export const NETWORK_ERROR_MESSAGE = "Couldn't reach FTC Pitfund. Check your connection."
