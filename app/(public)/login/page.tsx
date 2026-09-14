import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { PublicFooter } from '@/components/app/public-chrome'
import { Wordmark } from '@/components/app/wordmark'
import { Skeleton } from '@/components/ui/feedback'
import { getViewer } from '@/lib/server/viewer'
import { safeNext } from '@/lib/shared/schemas/account'
import { homeFor } from '@/lib/shared/viewer'

import { LoginFlow } from './login-flow'

export const metadata: Metadata = { title: 'Sign in' }

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
          <Suspense fallback={<LoginSkeleton />}>
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
  const viewer = await getViewer()
  if (viewer) redirect(next ?? homeFor(viewer))

  const error = typeof params.error === 'string' ? (ERRORS[params.error] ?? null) : null
  const notice = params.signed_out ? 'You’re signed out.' : params.deleted ? 'Your account was deleted.' : null
  return (
    <LoginFlow
      initialError={error}
      notice={notice}
      next={next ?? undefined}
      googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'}
    />
  )
}

function LoginSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-6">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-3 w-full" />
      <div className="grid gap-2">
        <Skeleton className="h-3.5 w-12" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  )
}
