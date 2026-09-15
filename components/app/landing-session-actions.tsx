'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

/*
 * The landing page is static, so it can't ask the server who is signed in. Instead this checks
 * for the Supabase session cookie in the browser: when one exists the top bar offers a single
 * "Open FTC Pitfund" link to /login, which redirects a signed-in visitor straight to their home.
 * A stale cookie just lands on the sign-in form, which is the right place anyway. Button classes
 * are computed on the server and passed in, so this island ships no styling helpers.
 */

const SESSION_COOKIE = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/

function subscribe() {
  return () => {}
}

function hasSessionCookie() {
  return SESSION_COOKIE.test(document.cookie)
}

export function LandingSessionActions({ primaryClass, ghostClass }: { primaryClass: string; ghostClass: string }) {
  const signedIn = useSyncExternalStore(subscribe, hasSessionCookie, () => false)

  if (signedIn) {
    return (
      <Link href="/login" prefetch={false} className={primaryClass}>
        Open FTC Pitfund
      </Link>
    )
  }

  return (
    <>
      <Link href="/login" prefetch={false} className={ghostClass}>
        Sign in
      </Link>
      <Link href="/login?intent=team" prefetch={false} className={`${primaryClass} max-[359px]:hidden`}>
        Get started
      </Link>
    </>
  )
}
