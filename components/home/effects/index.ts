import { initBento } from './bento'
import { initGlobes, initLines } from './canvases'
import { initCountdown } from './countdown'
import { initMarquee } from './marquee'
import { initNav } from './nav'
import { initPlay } from './play'
import { initAccordion, initCarousels, initFind, initStats } from './sections'
import { initWave } from './wave'

/** Wires every homepage behavior to the server-rendered markup under `root`. Returns one cleanup. */
export function initHome(root: HTMLElement | null) {
  if (!root) return () => {}
  root.querySelector<HTMLElement>('.hp-bento')?.setAttribute('data-enhanced', 'true')
  // One short task per effect, so wiring the page never blocks input: the controls people touch
  // first (menus, hero, cards) go first, the canvases and carousels further down follow.
  const queue = [initNav, initCountdown, initBento, initPlay, initWave, initMarquee, initAccordion, initCarousels, initFind, initStats, initGlobes, initLines]
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
