import { initCountdown } from './countdown'
import { initNav } from './nav'
import { initAccordion, initFind } from './sections'

/** Wires every homepage behavior to the server-rendered markup under `root`. Returns one cleanup. */
export function initHome(root: HTMLElement | null) {
  if (!root) return () => {}
  // One short task per effect, so wiring the page never blocks input: the menu people touch first goes first.
  const queue = [initNav, initCountdown, initAccordion, initFind]
  const cleanups: Array<() => void> = []
  let timer = 0
  let stopped = false
  const next = () => {
    const init = queue.shift()
    if (!init || stopped) return
    try {
      cleanups.push(init(root))
    } catch (err) {
      console.warn('[home] effect failed', err)
    }
    timer = window.setTimeout(next, 0)
  }
  next()
  return () => {
    stopped = true
    window.clearTimeout(timer)
    cleanups.forEach((c) => c())
  }
}
