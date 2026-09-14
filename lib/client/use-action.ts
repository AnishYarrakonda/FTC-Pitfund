'use client'

import { useCallback, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { NETWORK_ERROR_MESSAGE, type ActionError, type Result } from '@/lib/shared/result'

/*
 * The one way client code calls a server action (plan §3.1). It:
 *   - tracks pending state inside a transition (so buttons acknowledge in the same frame),
 *   - refuses to start a second run while one is in flight (double-submit safe),
 *   - turns a thrown network failure into "Couldn't reach FTC Pitfund…" with a Retry,
 *   - exposes field errors for forms and toasts only errors that have no field to sit next to.
 */

export type UseActionOptions<I, T> = {
  onSuccess?: (data: T, input: I) => void | Promise<void>
  onError?: (error: ActionError, input: I) => void
  /** Toast on success. Prefer in-place success; use this only for off-screen effects. */
  successToast?: string | ((data: T) => string | null)
  /** Toast errors that aren't tied to a field. Default true. */
  errorToast?: boolean
}

export type ActionState<T> = {
  pending: boolean
  error: ActionError | null
  fieldErrors: Record<string, string>
  data: T | null
}

export function isNetworkError(e: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = e instanceof Error ? e.message : String(e)
  return /failed to fetch|network|load failed|fetch failed|connection|aborted|an unexpected response was received/i.test(message)
}

export function useAction<I, T>(action: (input: I) => Promise<Result<T>>, options: UseActionOptions<I, T> = {}) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<Omit<ActionState<T>, 'pending'>>({ error: null, fieldErrors: {}, data: null })
  const inFlight = useRef(false)
  const lastInput = useRef<I | undefined>(undefined)
  const optionsRef = useRef(options)
  const runRef = useRef<((input: I) => Promise<Result<T> | null>) | null>(null)

  useLayoutEffect(() => {
    optionsRef.current = options
  })

  const run = useCallback(
    (input: I): Promise<Result<T> | null> => {
      if (inFlight.current) return Promise.resolve(null)
      inFlight.current = true
      lastInput.current = input

      return new Promise((resolve) => {
        startTransition(async () => {
          const opts = optionsRef.current
          let result: Result<T>
          try {
            result = await action(input)
          } catch (e) {
            const network = isNetworkError(e)
            result = {
              ok: false,
              error: network
                ? { code: 'UNAVAILABLE', message: NETWORK_ERROR_MESSAGE }
                : { code: 'UNKNOWN', message: 'Something went wrong. Try again in a moment.' },
            }
          } finally {
            inFlight.current = false
          }

          if (result.ok) {
            setState({ error: null, fieldErrors: {}, data: result.data })
            const message = typeof opts.successToast === 'function' ? opts.successToast(result.data) : opts.successToast
            if (message) toast.success(message)
            await opts.onSuccess?.(result.data, input)
          } else {
            const fieldErrors = result.error.fieldErrors ?? (result.error.field ? { [result.error.field]: result.error.message } : {})
            setState({ error: result.error, fieldErrors, data: null })
            opts.onError?.(result.error, input)
            const hasField = Object.keys(fieldErrors).length > 0
            if (opts.errorToast !== false && !hasField) {
              toast.error(result.error.message, {
                id: `action-error-${result.error.code}`,
                action:
                  result.error.code === 'UNAVAILABLE'
                    ? { label: 'Retry', onClick: () => void runRef.current?.(lastInput.current as I) }
                    : undefined,
              })
            }
          }
          resolve(result)
        })
      })
    },
    [action],
  )

  useLayoutEffect(() => {
    runRef.current = run
  }, [run])

  const reset = useCallback(() => setState({ error: null, fieldErrors: {}, data: null }), [])
  const retry = useCallback(() => (lastInput.current === undefined ? Promise.resolve(null) : run(lastInput.current)), [run])

  return { run, retry, reset, pending: isPending, ...state }
}
