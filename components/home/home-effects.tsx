'use client'

import { useEffect } from 'react'

/*
 * The homepage's only behavior island. It ships almost nothing in the first load: after the page is idle
 * it imports effects/index.ts (the canvases, carousels, menus, dialogs), which wires itself to the
 * server-rendered markup through data attributes and returns a cleanup.
 */
export function HomeEffects() {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false
    const start = () =>
      void import('./effects').then(({ initHome }) => {
        if (!cancelled) cleanup = initHome(document.querySelector('[data-hp-root]') as HTMLElement)
      })
    const idle = window.requestIdleCallback?.(start, { timeout: 600 }) ?? window.setTimeout(start, 1)
    return () => {
      cancelled = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
      cleanup?.()
    }
  }, [])
  return null
}
