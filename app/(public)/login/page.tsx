import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { PublicFooter } from '@/components/app/public-chrome'
import { Wordmark } from '@/components/app/wordmark'
import { newsreader } from '@/components/home/serif'
import { getViewer } from '@/lib/server/viewer'
import { parseIntent, safeNext } from '@/lib/shared/sign-in'
import { homeFor, welcomePath } from '@/lib/shared/viewer'

import { LoginFlow } from './login-flow'

export const metadata: Metadata = { title: 'Sign in' }

/*
 * Sign-in, laid out like the reference's: the mark centered on top, then one hairline-framed card with the
 * form on the left and, on wide screens, the rule the product is built on set in the homepage's serif.
 */
export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <div className={`flex min-h-dvh flex-col ${newsreader.variable}`}>
      <div className="flex justify-center pt-7 pb-6">
        <Wordmark />
      </div>
      <main id="main" className="mx-4 mb-4 flex flex-1 overflow-hidden rounded-[16px] border border-border sm:mx-6 sm:mb-6">
        <div className="flex w-full flex-col px-6 pt-12 pb-6 sm:px-10 sm:pt-14 lg:w-[486px] lg:shrink-0 lg:border-r lg:border-border">
          <div className="w-full max-w-auth lg:max-w-none">
            {/* The form is part of the static shell (it paints before any request-time work) and reads
                ?intent and ?next in the browser; the gate only redirects signed-in visitors. */}
            <LoginFlow />
            <Suspense fallback={null}>
              <SignedInRedirect searchParams={searchParams} />
            </Suspense>
          </div>
          <p className="mt-auto pt-12 text-caption text-text-tertiary">
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
        <aside
          aria-label="How FTC Pitfund works"
          className="hidden flex-1 flex-col items-center justify-center gap-8 px-12 text-center lg:flex"
          style={{ backgroundImage: 'linear-gradient(135deg, #f1f5fd 0%, #f6f8fc 55%, #fafbfd 100%)' }}
        >
          <p className="max-w-[22em] font-[family-name:var(--font-serif)] text-[26px] leading-[32px] tracking-[-0.01em] text-text text-balance">
            Every pitch is read by a person before a company sees it. Nothing about your team is shared until someone says yes.
          </p>
          <p className="grid gap-0.5 text-small">
            <span className="font-medium text-text-secondary">The rule FTC Pitfund is built on</span>
            <span className="text-text-tertiary">Run by FTC Team 31579 Exodius</span>
          </p>
        </aside>
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
  const home = homeFor(viewer)
  // A suspended person is sent here by every guard (page-guards.ts), so following ?next would send them
  // straight back: an endless redirect loop. Their home explains the suspension.
  const next = !viewer.suspendedAt && typeof params.next === 'string' ? safeNext(params.next) : null
  redirect(next ?? (home === '/welcome' && !viewer.pendingJoin ? welcomePath(parseIntent(params.intent)) : home))
}
