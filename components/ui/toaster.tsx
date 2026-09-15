'use client'

import { useEffect, useState, type ComponentType } from 'react'

import { registerToasterHost } from '@/lib/client/toast'

type SonnerToasterProps = { onReady: () => void }

/*
 * Where toasts appear (plan §3.1 #3: off-screen effects only). Renders nothing until the first
 * toast, then loads Sonner and its styled toaster (./sonner-toaster.tsx), so pages that never
 * toast don't ship either. Mount one per layout that has actions.
 */
export function Toaster() {
  const [Host, setHost] = useState<ComponentType<SonnerToasterProps> | null>(null)
  const [ready, setReady] = useState<(() => void) | null>(null)

  useEffect(
    () =>
      registerToasterHost(
        () =>
          new Promise<void>((resolve) => {
            void import('./sonner-toaster').then((mod) => {
              setReady(() => resolve)
              setHost(() => mod.default)
            })
          }),
      ),
    [],
  )

  // Fetch the code once the page is idle (after load, so it isn't first-load JS): a toast that
  // reports a lost connection must still be able to show.
  useEffect(() => {
    const prefetch = () => {
      void import('./sonner-toaster')
      void import('sonner')
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(prefetch, { timeout: 5000 })
      return () => cancelIdleCallback(id)
    }
    const timer = setTimeout(prefetch, 3000)
    return () => clearTimeout(timer)
  }, [])

  return Host && ready ? <Host onReady={ready} /> : null
}
