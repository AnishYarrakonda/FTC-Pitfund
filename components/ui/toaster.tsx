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

  return Host && ready ? <Host onReady={ready} /> : null
}
