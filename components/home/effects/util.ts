/* Shared helpers for the homepage effects. Every init returns a cleanup. */

export type Cleanup = () => void

export function on<K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): Cleanup {
  el.addEventListener(type, fn as EventListener, opts)
  return () => el.removeEventListener(type, fn as EventListener, opts)
}
