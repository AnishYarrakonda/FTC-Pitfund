import * as Sentry from '@sentry/nextjs'

import { scrubEvent } from './lib/shared/sentry-scrub'

export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: scrubEvent,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
