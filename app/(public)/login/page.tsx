import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { PublicFooter } from '@/components/app/public-chrome'
import { Wordmark } from '@/components/app/wordmark'
import { getViewer } from '@/lib/server/viewer'
import { parseIntent, safeNext } from '@/lib/shared/schemas/account'
import { homeFor, welcomePath } from '@/lib/shared/viewer'

import { LoginFlow } from './login-flow'

export const metadata: Metadata = { title: 'Sign in' }

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

const ERRORS: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: "Google sign-in didn't work. Try again, or use an email code.",
  link_expired: 'That sign-in link has expired. Send yourself a new code.',
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="flex flex-1 flex-col items-center px-4 pt-16 pb-16 sm:pt-24">
        <div className="w-full max-w-auth">
          <Wordmark className="mb-10" />
          {/* The static shell already shows the sign-in form, so it paints before any request-time
              work; the gate then redirects signed-in visitors or re-renders with ?intent, ?next and errors. */}
          <Suspense fallback={<LoginFlow initialError={null} notice={null} googleEnabled={GOOGLE_ENABLED} />}>
            <LoginGate searchParams={searchParams} />
          </Suspense>
          <p className="mt-10 text-small text-text-tertiary">
            By continuing you agree to the{' '}
            <Link href="/legal/terms" className="text-text-secondary underline decoration-border-strong underline-offset-4 hover:text-text hover:decoration-text-tertiary">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="text-text-secondary underline decoration-border-strong underline-offset-4 hover:text-text hover:decoration-text-tertiary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

async function LoginGate({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const params = await searchParams
  const next = typeof params.next === 'string' ? safeNext(params.next) : null
  const intent = parseIntent(params.intent)
  const viewer = await getViewer()
  if (viewer) {
    const home = homeFor(viewer)
    redirect(next ?? (home === '/welcome' && !viewer.pendingJoin ? welcomePath(intent) : home))
  }

  const error = typeof params.error === 'string' ? (ERRORS[params.error] ?? null) : null
  const notice = params.signed_out ? 'You’re signed out.' : params.deleted ? 'Your account was deleted.' : null
  return (
    <LoginFlow
      initialError={error}
      notice={notice}
      next={next ?? undefined}
      intent={intent}
      googleEnabled={GOOGLE_ENABLED}
    />
  )
}
