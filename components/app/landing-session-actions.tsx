'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/shared/cn'

/*
 * The landing page is static, so it can't ask the server who is signed in. Instead this checks
 * for the Supabase session cookie in the browser: when one exists the top bar offers a single
 * "Open FTC Pitfund" link to /login, which redirects a signed-in visitor straight to their home.
 * A stale cookie just lands on the sign-in form, which is the right place anyway.
 */

const SESSION_COOKIE = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/

function subscribe() {
  return () => {}
}

function hasSessionCookie() {
  return SESSION_COOKIE.test(document.cookie)
}

export function LandingSessionActions() {
  const signedIn = useSyncExternalStore(subscribe, hasSessionCookie, () => false)

  if (signedIn) {
    return (
      <Link href="/login" prefetch={false} className={buttonVariants({ size: 'sm' })}>
        Open FTC Pitfund
      </Link>
    )
  }

  return (
    <>
      <Link href="/login" prefetch={false} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-text')}>
        Sign in
      </Link>
      <Link href="/login?intent=team" prefetch={false} className={cn(buttonVariants({ size: 'sm' }), 'max-[359px]:hidden')}>
        Get started
      </Link>
    </>
  )
}
