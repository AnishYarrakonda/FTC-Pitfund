import { type Cleanup } from './util'

/*
 * CSS loops in the illustrations (cross-fading screens, status pills, drifting ribbons) are paused
 * by default and run only while their block is on screen, so off-screen decoration costs nothing.
 */
export function initPlay(root: HTMLElement): Cleanup {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement
      if (e.isIntersecting) el.dataset.play = ''
      else delete el.dataset.play
    }
  })
  root.querySelectorAll('.hp-bento__card, .hp-banner, .hp-flow, .hp-paths, .hp-dialog__panel').forEach((el) => io.observe(el))
  return () => io.disconnect()
}
