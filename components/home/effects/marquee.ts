import { type Cleanup, loopWhileVisible, on, reducedMotion } from './util'

/* The logo strip: drifts left forever, pauses under the pointer, and can be dragged or flicked. */
export function initMarquee(root: HTMLElement): Cleanup {
  const vp = root.querySelector<HTMLElement>('[data-hp-marquee]')
  const track = vp?.querySelector<HTMLElement>('.hp-logos__track')
  if (!vp || !track) return () => {}
  let x = 0
  let v = 0
  let last = 0
  let hovering = false
  let dragging = false
  let startX = 0
  let startPos = 0
  let lastPointer = 0
  const speed = reducedMotion() ? 0 : 28

  const wrap = () => {
    const half = track.scrollWidth / 2
    if (half > 0) {
      while (x <= -half) x += half
      while (x > 0) x -= half
    }
  }
  const stop = loopWhileVisible(vp, (t) => {
    const dt = last ? Math.min(0.05, t - last) : 0
    last = t
    if (!dragging) {
      v *= 0.94
      x += (hovering ? 0 : -speed * dt) + v * dt
    }
    wrap()
    track.style.transform = `translate3d(${x}px,0,0)`
  })
  const offs = [
    on(vp, 'pointerenter', () => (hovering = true)),
    on(vp, 'pointerleave', () => (hovering = false)),
    on(vp, 'pointerdown', (e: PointerEvent) => {
      dragging = true
      startX = e.clientX
      startPos = x
      lastPointer = e.clientX
      v = 0
      vp.setPointerCapture(e.pointerId)
      vp.dataset.dragging = 'true'
    }),
    on(vp, 'pointermove', (e: PointerEvent) => {
      if (!dragging) return
      x = startPos + (e.clientX - startX)
      v = (e.clientX - lastPointer) * 60
      lastPointer = e.clientX
    }),
    on(vp, 'pointerup', () => {
      dragging = false
      delete vp.dataset.dragging
    }),
  ]
  return () => {
    stop()
    offs.forEach((f) => f())
  }
}
