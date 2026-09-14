import type * as SentryModule from '@sentry/nextjs'
import { initBotId } from 'botid/client/core'

import { loadSentry, sentryEnabled } from './lib/client/sentry'
import { scrubEvent } from './lib/shared/sentry-scrub'

// Bot protection on the email-code request (a server action POST to /login) and, from
// prompt 2, the public report form.
initBotId({
  protect: [
    { path: '/login', method: 'POST' },
    { path: '/t/*', method: 'POST' },
  ],
})

// Sentry loads on demand (lib/client/sentry.ts) so it stays out of first-load JS.
if (sentryEnabled) {
  void loadSentry().then((Sentry) =>
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: scrubEvent,
    }),
  )
}

export function onRouterTransitionStart(...args: Parameters<typeof SentryModule.captureRouterTransitionStart>) {
  if (sentryEnabled) void loadSentry().then((Sentry) => Sentry.captureRouterTransitionStart(...args))
}
