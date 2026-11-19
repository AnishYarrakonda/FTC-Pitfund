import { type Cleanup, clamp, onFrame, reducedMotion } from './util'

/*
 * Every scroll-scrubbed effect, measured on attio.com and driven from one frame loop (util.onFrame):
 *  - Hero: past 60px the headline blurs away (a CSS transition on [data-scrolled]); between 150px and
 *    450px the white cap over the lavender field shrinks to 57% × 75%; the satellite windows fade in out of
 *    a blur, one after another, over the first ~110px.
 *  - Head: the bar takes the tone of the section under its bottom edge.
 *  - Chapter rail: the chapter crossing 40% of the viewport is the current one.
 *  - Principle: its words darken one by one as you scroll through the pin. Outside the pin they keep their
 *    full color, so a full-page screenshot or a reader arriving by anchor never sees a half-lit sentence.
 */

/* Scroll offset at which each satellite starts to appear, in DOM order: top left, bottom left, right. */
const SAT_START = [15, 0, 45]

export function initScroll(root: HTMLElement): Cleanup {
  const offs: Cleanup[] = []
  const still = reducedMotion()

  const hero = root.querySelector<HTMLElement>('[data-hp-hero]')
  const cap = root.querySelector<HTMLElement>('[data-hp-cap]')
  const sats = [...root.querySelectorAll<HTMLElement>('[data-hp-sat]')]
  if (hero) {
    let wasScrolled = false
    let lastCap = ''
    let lastSat = ''
    offs.push(
      onFrame(() => {
        const y = window.scrollY
        const scrolled = y > 60
        if (scrolled !== wasScrolled) {
          wasScrolled = scrolled
          hero.toggleAttribute('data-scrolled', scrolled)
        }
        if (still) return
        if (y > hero.offsetHeight + 200) return
        const p = clamp((y - 150) / 300)
        const capT = p === 0 ? 'none' : `scaleX(${(1 - 0.4286 * p).toFixed(4)}) scaleY(${(1 - 0.25 * p).toFixed(4)})`
        if (cap && capT !== lastCap) {
          lastCap = capT
          cap.style.transform = capT
        }
        // Satellites appear one by one (bottom left, top left, right) over the first ~110px, out of a
        // 3px blur, and settle back to 94% as the window rises.
        const key = Math.round(Math.min(y, 160))
        if (String(key) !== lastSat) {
          lastSat = String(key)
          const scale = 1 - 0.064 * clamp(y / 90)
          sats.forEach((el, i) => {
            const p = clamp((y - SAT_START[i % SAT_START.length]) / 60)
            el.style.opacity = String(p)
            el.style.filter = p >= 1 ? 'none' : `blur(${(3 * (1 - p)).toFixed(2)}px)`
            el.style.transform = `scale(${scale.toFixed(4)})`
          })
        }
      }),
    )
  }

  const nav = root.querySelector<HTMLElement>('[data-hp-nav]')
  const darks = [...root.querySelectorAll<HTMLElement>('[data-hp-tone="dark"]')]
  if (nav && darks.length) {
    let tone = 'light'
    offs.push(
      onFrame(() => {
        const line = nav.getBoundingClientRect().bottom
        const next = darks.some((d) => {
          const r = d.getBoundingClientRect()
          return r.top <= line && r.bottom > line
        })
          ? 'dark'
          : 'light'
        if (next !== tone) {
          tone = next
          nav.dataset.tone = next
        }
      }),
    )
  }

  const rail = root.querySelector<HTMLElement>('[data-hp-rail]')
  const chapters = [...root.querySelectorAll<HTMLElement>('[data-hp-chapter]')]
  if (rail && chapters.length) {
    const links = new Map([...rail.querySelectorAll<HTMLAnchorElement>('[data-hp-rail-link]')].map((a) => [a.dataset.hpRailLink!, a]))
    let current = chapters[0].dataset.hpChapter!
    offs.push(
      onFrame(() => {
        const mark = window.innerHeight * 0.4
        let next = chapters[0].dataset.hpChapter!
        for (const c of chapters) if (c.getBoundingClientRect().top <= mark) next = c.dataset.hpChapter!
        if (next === current) return
        links.get(current)?.removeAttribute('aria-current')
        current = next
        const link = links.get(current)
        if (!link) return
        link.setAttribute('aria-current', 'step')
        // On narrow screens the rail is a strip of tabs: keep the current one in view.
        if (rail.scrollWidth > rail.clientWidth) {
          const left = link.offsetLeft - (rail.clientWidth - link.offsetWidth) / 2
          rail.scrollTo({ left, behavior: still ? 'auto' : 'smooth' })
        }
      }),
    )
  }

  const quote = root.querySelector<HTMLElement>('[data-hp-quote]')
  const pin = quote?.closest<HTMLElement>('.hp-principle')
  if (quote && pin && !still) {
    const words = [...quote.querySelectorAll<HTMLElement>('span')]
    let lit = words.length
    offs.push(
      onFrame(() => {
        const r = pin.getBoundingClientRect()
        const vh = window.innerHeight
        // Only while the pin is on screen; otherwise every word keeps its full color.
        const inPin = r.top < vh && r.bottom > 0
        // The section starts a screen above its pin, under the dark section. The words light while the
        // dark section slides off it, finishing just before it is fully gone.
        const p = inPin ? clamp(-r.top / (vh * 0.8)) : 1
        const next = Math.round(p * words.length)
        if (next === lit) return
        lit = next
        words.forEach((w, i) => w.classList.toggle('is-dim', i >= lit))
      }),
    )
  }

  return () => offs.forEach((f) => f())
}
