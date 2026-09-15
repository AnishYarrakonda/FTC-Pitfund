import { useCallback, useRef, useState, type ComponentType } from 'react'

/*
 * Code-split an interactive component until someone reaches for it: `preload` on hover or focus,
 * `open` on click. Until then the caller renders a lookalike trigger. Keeps Radix overlays out of
 * first-load JS (plan §6).
 */
export function useLazyComponent<P>(load: () => Promise<{ default: ComponentType<P> }>) {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null)
  const [openOnMount, setOpenOnMount] = useState(false)
  const pending = useRef<Promise<void> | null>(null)

  const preload = useCallback(() => {
    pending.current ??= load().then((mod) => setComponent(() => mod.default))
    return pending.current
  }, [load])

  const open = useCallback(() => {
    setOpenOnMount(true)
    void preload()
  }, [preload])

  return { Component, openOnMount, preload, open }
}
