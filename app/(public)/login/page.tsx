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

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="flex flex-1 flex-col items-center px-4 pt-16 pb-16 sm:pt-24">
        <div className="w-full max-w-auth">
          <Wordmark className="mb-10" />
          {/* The form is part of the static shell (it paints before any request-time work) and reads
              ?intent, ?next and ?error in the browser; the gate only redirects signed-in visitors. */}
          <LoginFlow googleEnabled={GOOGLE_ENABLED} />
          <Suspense fallback={null}>
            <SignedInRedirect searchParams={searchParams} />
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

/** A signed-in visitor goes straight to their home (or ?next, or /welcome with their ?intent). */
async function SignedInRedirect({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const params = await searchParams
  const viewer = await getViewer()
  if (!viewer) return null
  const next = typeof params.next === 'string' ? safeNext(params.next) : null
  const home = homeFor(viewer)
  redirect(next ?? (home === '/welcome' && !viewer.pendingJoin ? welcomePath(parseIntent(params.intent)) : home))
}
