import type * as SentryModule from '@sentry/nextjs'

/*
 * The Sentry browser SDK, loaded on demand. A static import put ~60 KB (gzipped) into every
 * route's first-load JS (plan §6 budget: 170 KB); now it loads after hydration, and only when a
 * DSN is configured. Reports made while it loads wait for it; uncaught errors before init are missed.
 */

export const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

let loader: Promise<typeof SentryModule> | null = null

export function loadSentry() {
  loader ??= import('@sentry/nextjs')
  return loader
}

/** Report an error; resolves to a short reference id to show the person (Sentry's, or a local one). */
export async function captureClientException(error: unknown): Promise<string> {
  const local = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  if (!sentryEnabled) return local
  const Sentry = await loadSentry()
  return Sentry.captureException(error)?.slice(0, 12) || local
}
