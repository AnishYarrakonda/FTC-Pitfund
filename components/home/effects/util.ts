/* Shared helpers for the homepage effects. Every init returns a cleanup. */

export type Cleanup = () => void

export function on<K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): Cleanup {
  el.addEventListener(type, fn as EventListener, opts)
  return () => el.removeEventListener(type, fn as EventListener, opts)
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/*
 * One passive scroll/resize listener and one requestAnimationFrame for every scroll-driven effect on the
 * page: each registers a frame function, and they all run together at most once per frame. Frame
 * functions only read layout first and then write transforms/attributes, so nothing thrashes.
 */
const frames = new Set<() => void>()
let queued = 0
let detach: Cleanup | null = null

function run() {
  queued = 0
  frames.forEach((f) => f())
}
function schedule() {
  if (!queued) queued = requestAnimationFrame(run)
}

export function onFrame(fn: () => void): Cleanup {
  frames.add(fn)
  if (!detach) {
    const offScroll = on(window, 'scroll', schedule, { passive: true })
    const offResize = on(window, 'resize', schedule, { passive: true })
    detach = () => {
      offScroll()
      offResize()
      cancelAnimationFrame(queued)
      queued = 0
    }
  }
  fn()
  return () => {
    frames.delete(fn)
    if (!frames.size && detach) {
      detach()
      detach = null
    }
  }
}
