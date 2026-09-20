/* Shared helpers for the homepage effects. Every init returns a cleanup. */

export type Cleanup = () => void

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function on<K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): Cleanup {
  el.addEventListener(type, fn as EventListener, opts)
  return () => el.removeEventListener(type, fn as EventListener, opts)
}

/**
 * Runs `frame(t)` on animation frames only while `el` is on screen. A graphic is decoration, so it
 * never gets to hog the main thread: if frames cost more than ~12 ms it drops to every other frame,
 * and if they cost more than ~40 ms (a slow phone, a software GPU) it keeps the last frame and stops.
 * Under reduced motion it draws one frame.
 */
export function loopWhileVisible(el: Element, frame: (t: number) => void): Cleanup {
  let raf = 0
  let visible = false
  let cost = 0
  let n = 0
  let skip = false
  let stopped = false
  let odd = false
  const tick = (t: number) => {
    odd = !odd
    if (!skip || odd) {
      const start = performance.now()
      frame(t / 1000)
      const spent = performance.now() - start
      cost = n === 0 ? spent : cost * 0.8 + spent * 0.2
      n++
      if (n > 6 && cost > 40) stopped = true
      else if (n > 6 && cost > 12) skip = true
    }
    if (visible && !stopped && !reducedMotion()) raf = requestAnimationFrame(tick)
  }
  const io = new IntersectionObserver(([entry]) => {
    const was = visible
    visible = entry.isIntersecting
    if (visible && !was && !stopped) raf = requestAnimationFrame(tick)
    if (!visible) cancelAnimationFrame(raf)
  })
  io.observe(el)
  return () => {
    io.disconnect()
    cancelAnimationFrame(raf)
  }
}

/** Sizes a canvas to its CSS box at a capped device pixel ratio; returns [width, height, dpr]. */
export function fitCanvas(c: HTMLCanvasElement, maxDpr = 2): [number, number, number] {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
  const r = c.getBoundingClientRect()
  const w = Math.max(1, Math.round(r.width * dpr))
  const h = Math.max(1, Math.round(r.height * dpr))
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  }
  return [w, h, dpr]
}

/** A small deterministic random generator, so graphics look the same on every load. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
