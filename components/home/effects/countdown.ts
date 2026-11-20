import { type Cleanup } from './util'

/*
 * The banner's live figure: whole days left in the current pitch season (seasons run Sept 1 → Aug 31,
 * see lib/shared/season.ts). Days, not a ticking clock: a deadline months away doesn't need seconds.
 */
function seasonEnd(now: Date) {
  const y = now.getUTCMonth() + 1 >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return Date.UTC(y + 1, 8, 1)
}

export function initCountdown(root: HTMLElement): Cleanup {
  const el = root.querySelector<HTMLElement>('[data-hp-countdown]')
  if (!el) return () => {}
  const render = () => {
    const days = Math.max(0, Math.ceil((seasonEnd(new Date()) - Date.now()) / 86_400_000))
    el.textContent = `${days} ${days === 1 ? 'day' : 'days'}`
  }
  render()
  const id = window.setInterval(render, 60_000)
  return () => window.clearInterval(id)
}
