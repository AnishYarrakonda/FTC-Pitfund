import { expect } from 'vitest'

import { AppError } from '@/lib/server/result'

type ErrorMatch = { message?: string | RegExp; field?: string; href?: string }

/** Await a data-function call that must throw an AppError with this code (and optional message/extra). */
export async function expectAppError(promise: Promise<unknown>, code: AppError['code'], match?: ErrorMatch) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, `expected AppError ${code}`).toBeInstanceOf(AppError)
  const appError = error as AppError
  expect(appError.code).toBe(code)
  if (match) {
    const { message, ...extra } = match
    if (message instanceof RegExp) expect(appError.message).toMatch(message)
    else if (message !== undefined) expect(appError.message).toBe(message)
    expect(appError.extra).toMatchObject(extra)
  }
  return appError
}
