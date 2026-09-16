'use client'

import { useEffect } from 'react'
import { Toaster as Sonner } from 'sonner'

/**
 * Sonner as a positioner only. Every toast body is ours (components/ui/toast-content.tsx) so it can
 * carry a decay bar and a dismiss button; Sonner keeps the stacking, the timers, pause-on-hover and
 * the swipe-to-dismiss. Loaded by ./toaster.tsx on the first toast.
 */
export default function SonnerToaster({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady])
  return <Sonner position="bottom-right" gap={8} offset={16} mobileOffset={16} visibleToasts={3} toastOptions={{ unstyled: true }} />
}
