import { initBurst } from './canvases'
import { matchIntent } from './find-match'
import { type Cleanup, on } from './util'

/* Stats menu + sky, the sticky accordion, the three carousels, and the "find where to start" box. */

const TIMES = ['pre-dawn', 'sunrise', 'daytime', 'dusk', 'sunset', 'night']
function localTime() {
  const h = new Date().getHours()
  if (h < 5) return 'night'
  if (h < 7) return 'pre-dawn'
  if (h < 9) return 'sunrise'
  if (h < 16) return 'daytime'
  if (h < 18) return 'dusk'
  if (h < 20) return 'sunset'
  return 'night'
}

export function initStats(root: HTMLElement): Cleanup {
  const sec = root.querySelector<HTMLElement>('[data-hp-stats]')
  if (!sec) return () => {}
  const offs: Cleanup[] = []
  sec.dataset.time = localTime()
  let active = 0
  const stats = [...sec.querySelectorAll<HTMLButtonElement>('[data-hp-stat]')]
  const select = (i: number) => {
    active = i
    sec.style.setProperty('--active', String(i))
    stats.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)))
  }
  stats.forEach((b, i) => {
    offs.push(on(b, 'click', () => select(i)))
    offs.push(
      on(b, 'keydown', (e: KeyboardEvent) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
        const n = (i + (e.key === 'ArrowRight' ? 1 : stats.length - 1)) % stats.length
        select(n)
        stats[n].focus()
      }),
    )
  })
  select(0)
  /*
   * The sky layers and the time picker they belong to were taken out of the markup; the stats sit on
   * the plain canvas now. This used to assert both were there, so every homepage load threw here and
   * logged "[home] effect failed" — swallowed as a warning, which is why no gate caught it, and
   * everything after this point (the burst canvas) silently never wired.
   */
  const btn = sec.querySelector<HTMLButtonElement>('[data-hp-time-btn]')
  const menu = sec.querySelector<HTMLElement>('[data-hp-time-menu]')
  if (btn && menu) {
    offs.push(
      on(btn, 'click', () => {
        menu.hidden = !menu.hidden
        btn.setAttribute('aria-expanded', String(!menu.hidden))
      }),
    )
    menu.querySelectorAll<HTMLButtonElement>('[data-hp-time]').forEach((b) =>
      offs.push(
        on(b, 'click', () => {
          sec.dataset.time = b.dataset.hpTime!
          menu.hidden = true
          btn.setAttribute('aria-expanded', 'false')
        }),
      ),
    )
  }
  offs.push(initBurst(sec, () => (TIMES.includes(sec.dataset.time!) ? sec.dataset.time! : 'daytime'), () => active))
  return () => offs.forEach((f) => f())
}

export function initAccordion(root: HTMLElement): Cleanup {
  const offs: Cleanup[] = []
  root.querySelectorAll<HTMLElement>('[data-hp-accordion]').forEach((acc) => {
    const items = [...acc.querySelectorAll<HTMLElement>('.hp-story')]
    const setOpen = (item: HTMLElement | null) => {
      items.forEach((it) => {
        const isOpen = it === item
        it.dataset.open = String(isOpen)
        it.querySelector('[data-hp-story]')!.setAttribute('aria-expanded', String(isOpen))
      })
    }
    // Opening one closes the others; clicking the open one folds it away.
    items.forEach((it) => offs.push(on(it.querySelector('[data-hp-story]')!, 'click', () => setOpen(it.dataset.open === 'true' ? null : it))))
  })
  return () => offs.forEach((f) => f())
}

export function initCarousels(root: HTMLElement): Cleanup {
  const offs: Cleanup[] = []

  // Company cards: arrows page the track; hovering a card widens it and nudges its neighbors (CSS).
  root.querySelectorAll<HTMLElement>('[data-hp-carousel]').forEach((car) => {
    const track = car.querySelector<HTMLElement>('[data-hp-track]')!
    const step = () => (track.firstElementChild as HTMLElement).getBoundingClientRect().width + 16
    const update = () => {
      car.querySelector<HTMLButtonElement>('[data-hp-prev]')!.disabled = track.scrollLeft < 4
      car.querySelector<HTMLButtonElement>('[data-hp-next]')!.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4
    }
    offs.push(on(car.querySelector('[data-hp-prev]')!, 'click', () => track.scrollBy({ left: -step() * 2, behavior: 'smooth' })))
    offs.push(on(car.querySelector('[data-hp-next]')!, 'click', () => track.scrollBy({ left: step() * 2, behavior: 'smooth' })))
    offs.push(on(track, 'scroll', update, { passive: true }))
    update()
  })

  // FAQ quotes: tabs below, a bar slides to the selected tab, the quote cross-fades.
  root.querySelectorAll<HTMLElement>('[data-hp-quotes]').forEach((q) => {
    const tabs = [...q.querySelectorAll<HTMLButtonElement>('[data-hp-quote]')]
    const cards = [...q.querySelectorAll<HTMLElement>('.hp-quote')]
    const select = (i: number) => {
      tabs.forEach((t, j) => {
        t.setAttribute('aria-selected', String(i === j))
        t.tabIndex = i === j ? 0 : -1
      })
      cards.forEach((c, j) => (c.dataset.active = String(i === j)))
      const t = tabs[i]
      q.style.setProperty('--bar-x', `${t.offsetLeft}px`)
      q.style.setProperty('--bar-w', `${t.offsetWidth}px`)
    }
    tabs.forEach((t, i) => {
      offs.push(on(t, 'click', () => select(i)))
      offs.push(
        on(t, 'keydown', (e: KeyboardEvent) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
          const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
          select(n)
          tabs[n].focus()
        }),
      )
    })
    select(0)
    offs.push(on(window, 'resize', () => select(tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'))))
  })

  // What's new: the active item is wide, the rest squeeze; arrows and clicks move it.
  root.querySelectorAll<HTMLElement>('[data-hp-news]').forEach((n) => {
    const items = [...n.querySelectorAll<HTMLElement>('[data-hp-news-item]')]
    const details = [...n.querySelectorAll<HTMLElement>('[data-hp-news-detail]')]
    let cur = 0
    const select = (i: number) => {
      cur = (i + items.length) % items.length
      items.forEach((it, j) => (it.dataset.active = String(j === cur)))
      details.forEach((d, j) => (d.dataset.active = String(j === cur)))
    }
    items.forEach((it, i) => offs.push(on(it, 'click', () => select(i))))
    const sec = n.closest('section')!
    offs.push(on(sec.querySelector('[data-hp-news-prev]')!, 'click', () => select(cur - 1)))
    offs.push(on(sec.querySelector('[data-hp-news-next]')!, 'click', () => select(cur + 1)))
  })

  return () => offs.forEach((f) => f())
}

/*
 * "Find where to start". The matching lives in ./find-match (and is held to a corpus of real
 * sentences by tests/unit/find-match.test.ts); this is only the wiring. Nothing leaves the page:
 * no request, no storage, no key, no model.
 */
const TYPING_PAUSE = 500
/* Under this, a live answer would be answering half a sentence; we wait for the pause or for Enter. */
const LIVE_MIN_CHARS = 12

export function initFind(root: HTMLElement): Cleanup {
  const form = root.querySelector<HTMLFormElement>('[data-hp-find]')
  if (!form) return () => {}
  const input = form.querySelector<HTMLTextAreaElement>('[data-hp-find-input]')!
  const count = form.querySelector<HTMLElement>('[data-hp-find-count]')!
  const ring = form.querySelector<HTMLElement>('[data-hp-find-ring]')!
  const answer = root.querySelector<HTMLElement>('[data-hp-find-answer]')!

  const button = (label: string, href: string, kind: 'primary' | 'secondary') => {
    const a = document.createElement('a')
    a.href = href
    a.className = `hp-btn hp-btn--sm hp-btn--${kind}`
    a.textContent = label
    return a
  }
  const say = (sentence: string, ...actions: HTMLElement[]) => {
    const p = document.createElement('p')
    p.textContent = sentence
    answer.replaceChildren(p, ...actions)
  }

  /*
   * `submitted` is Enter, the send button or a chip; otherwise this is the pause after typing. The
   * only difference is what happens when nothing matches: mid-sentence we stay quiet rather than
   * telling someone we don't understand a question they haven't finished asking.
   */
  const route = (submitted: boolean) => {
    const text = input.value.trim()
    if (!text) {
      ring.style.setProperty('--p', '0')
      if (submitted) say('Tell us who you are, or what you need — a few words is enough.')
      else answer.replaceChildren()
      return
    }
    const match = matchIntent(text)
    ring.style.setProperty('--p', String(match ? Math.max(0.12, match.confidence) : 0.06))
    if (!match) {
      if (!submitted && text.length < LIVE_MIN_CHARS) return
      say(
        'We can’t tell from that which side you’re on. Almost everyone here is one of these two:',
        button('I coach a team', '/login?intent=team', 'primary'),
        button('I represent a company', '/login?intent=company', 'secondary'),
      )
      return
    }
    const actions = [button(match.intent.cta, match.intent.href, 'primary')]
    // A close second: offer the other reading instead of quietly picking one.
    if (match.runnerUp) actions.push(button(match.runnerUp.also, match.runnerUp.href, 'secondary'))
    say(match.intent.text, ...actions)
  }

  let timer = 0
  const meter = () => {
    count.textContent = `${input.value.length}/500`
    form.dataset.filled = String(input.value.trim().length > 0)
  }
  const submit = () => {
    clearTimeout(timer)
    route(true)
  }
  const offs: Cleanup[] = [
    () => clearTimeout(timer),
    on(input, 'input', () => {
      meter()
      clearTimeout(timer)
      timer = window.setTimeout(() => route(false), TYPING_PAUSE)
    }),
    on(form, 'submit', (e: SubmitEvent) => {
      e.preventDefault()
      submit()
    }),
    on(input, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    }),
  ]
  form.querySelectorAll<HTMLButtonElement>('[data-hp-chip]').forEach((b) =>
    offs.push(
      on(b, 'click', () => {
        input.value = b.dataset.hpChip!
        meter()
        submit()
      }),
    ),
  )
  meter()
  return () => offs.forEach((f) => f())
}
