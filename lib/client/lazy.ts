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

  /**
   * Pass the focused lookalike (`onFocus={(e) => preload(e.currentTarget)}`): swapping it for the real
   * trigger destroys the element that has keyboard focus, so focus falls to <body>, the focus ring
   * disappears and the next Enter does nothing. Put focus back on the new button with the same name.
   */
  const preload = useCallback(
    (focused?: HTMLElement) => {
      const label = focused?.getAttribute('aria-label') ?? null
      pending.current ??= load().then((mod) => {
        setComponent(() => mod.default)
        if (label) refocus(label)
      })
      return pending.current
    },
    [load],
  )

  const open = useCallback(() => {
    setOpenOnMount(true)
    void preload()
  }, [preload])

  return { Component, openOnMount, preload, open }
}

/** After React has committed the swap: refocus the button with this name, unless focus has already moved on. */
function refocus(label: string) {
  const attempt = (tries: number) =>
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return
      const target = document.querySelector<HTMLElement>(`button[aria-label="${CSS.escape(label)}"]`)
      if (target) target.focus()
      else if (tries > 0) attempt(tries - 1)
    })
  attempt(3)
}
