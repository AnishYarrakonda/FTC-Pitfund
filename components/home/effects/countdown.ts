import { type Cleanup } from './util'

/*
 * The hero eyebrow's live figure: time left in the current pitch season (seasons run Sept 1 → Aug 31,
 * see lib/shared/season.ts). Each digit is an odometer wheel that rolls to its next value, like the
 * live counter on the reference homepage.
 */
function seasonEnd(now: Date) {
  const y = now.getUTCMonth() + 1 >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return Date.UTC(y + 1, 8, 1)
}

function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d}d ${p(h)}h ${p(m)}m ${p(sec)}s`
}

export function initCountdown(root: HTMLElement): Cleanup {
  const el = root.querySelector<HTMLElement>('[data-hp-countdown]')
  if (!el) return () => {}
  el.textContent = ''
  const label = document.createElement('span')
  label.className = 'hp-sr'
  const wheels: HTMLElement[] = []
  const face = document.createElement('span')
  face.setAttribute('aria-hidden', 'true')
  el.append(label, face)

  const render = () => {
    const text = format(seasonEnd(new Date()) - Date.now())
    label.textContent = text
    if (face.childElementCount !== text.length) {
      face.textContent = ''
      wheels.length = 0
      for (const ch of text) {
        const slot = document.createElement('span')
        if (/\d/.test(ch)) {
          slot.className = 'hp-odo'
          const strip = document.createElement('span')
          strip.className = 'hp-odo__strip'
          strip.textContent = '0123456789'.split('').join('\n')
          slot.append(strip)
          wheels.push(strip)
        } else {
          slot.className = 'hp-odo-sep'
          slot.textContent = ch
          wheels.push(slot)
        }
        face.append(slot)
      }
    }
    ;[...text].forEach((ch, i) => {
      if (/\d/.test(ch)) wheels[i].style.transform = `translateY(${-Number(ch) * 10}%)`
    })
  }
  render()
  const id = window.setInterval(render, 1000)
  return () => window.clearInterval(id)
}
