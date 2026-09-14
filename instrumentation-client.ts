import * as Sentry from '@sentry/nextjs'
import { initBotId } from 'botid/client/core'

import { scrubEvent } from './lib/shared/sentry-scrub'

// Bot protection on the email-code request (a server action POST to /login) and, from
// prompt 2, the public report form.
initBotId({
  protect: [
    { path: '/login', method: 'POST' },
    { path: '/t/*', method: 'POST' },
  ],
})

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
