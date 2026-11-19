import { matchIntent } from './find-match'
import { type Cleanup, on, reducedMotion } from './util'

/* The "what's shared" steps, the two-sides tabs, reveal-on-enter, and the "find where to start" box. */

/*
 * "What's shared, and when": one item open at a time, each with a progress line. While the list is on
 * screen it advances by itself every 6 s, like the reference's; a click or keypress on an item takes over
 * and stops the cycle. Off screen, or with reduced motion, it holds still.
 */
const STEP_MS = 6000

export function initSteps(root: HTMLElement): Cleanup {
  const list = root.querySelector<HTMLElement>('[data-hp-steps]')
  if (!list) return () => {}
  const items = [...list.querySelectorAll<HTMLElement>('[data-hp-step]')]
  const art = root.querySelector<HTMLElement>('[data-hp-shared-art]')
  let index = 0
  let timer = 0
  let auto = !reducedMotion()
  let visible = false

  const open = (i: number) => {
    index = i
    items.forEach((it, k) => {
      it.dataset.open = String(k === i)
      it.toggleAttribute('data-running', false)
      it.querySelector('[data-hp-step-btn]')!.setAttribute('aria-expanded', String(k === i))
    })
    if (art) art.dataset.ring = items[i].dataset.hpStep!
    schedule()
  }
  const schedule = () => {
    window.clearTimeout(timer)
    if (!auto || !visible) return
    const it = items[index]
    // Restart the bar's fill from empty.
    it.toggleAttribute('data-running', false)
    void it.offsetWidth
    it.style.setProperty('--hp-step', `${STEP_MS}ms`)
    it.toggleAttribute('data-running', true)
    timer = window.setTimeout(() => open((index + 1) % items.length), STEP_MS)
  }

  const offs: Cleanup[] = [() => window.clearTimeout(timer)]
  items.forEach((it, i) =>
    offs.push(
      on(it.querySelector('[data-hp-step-btn]')!, 'click', () => {
        auto = false
        open(i)
      }),
    ),
  )
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) schedule()
    else window.clearTimeout(timer)
  })
  io.observe(list)
  offs.push(() => io.disconnect())
  return () => offs.forEach((f) => f())
}

/* Tabs (the two sides): click, arrow keys, Home/End; one panel shown. */
export function initTabs(root: HTMLElement): Cleanup {
  const offs: Cleanup[] = []
  root.querySelectorAll<HTMLElement>('[data-hp-tabs]').forEach((list) => {
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    const select = (t: HTMLButtonElement, focus = false) => {
      tabs.forEach((x) => {
        const on = x === t
        x.setAttribute('aria-selected', String(on))
        x.tabIndex = on ? 0 : -1
        const panel = document.getElementById(x.getAttribute('aria-controls')!)
        if (panel) panel.hidden = !on
      })
      if (focus) t.focus()
    }
    tabs.forEach((t, i) => {
      offs.push(
        on(t, 'click', () => select(t)),
        on(t, 'keydown', (e: KeyboardEvent) => {
          const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
          if (to === null) return
          e.preventDefault()
          select(tabs[(to + tabs.length) % tabs.length], true)
        }),
      )
    })
  })
  return () => offs.forEach((f) => f())
}

/*
 * Reveal on enter: [data-hp-reveal] gets .is-in as it nears the viewport, which starts its CSS entrance
 * (a rise, a line drawing itself). Nothing is hidden before that: the entrance starts from its first
 * keyframe, so content far below the fold is complete in a screenshot and for anyone without scripts.
 */
export function initReveal(root: HTMLElement): Cleanup {
  if (reducedMotion()) return () => {}
  const targets = [...root.querySelectorAll<HTMLElement>('[data-hp-reveal]')]
  const vh = window.innerHeight
  // Already on screen at load: no entrance, it would only flash.
  const pending = targets.filter((t) => t.getBoundingClientRect().top > vh)
  if (!pending.length) return () => {}
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px 8% 0px' },
  )
  pending.forEach((t) => io.observe(t))
  return () => io.disconnect()
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
  const input = form.querySelector<HTMLInputElement>('[data-hp-find-input]')!
  const answer = root.querySelector<HTMLElement>('[data-hp-find-answer]')!

  const button = (label: string, href: string, kind: 'primary' | 'outline') => {
    const a = document.createElement('a')
    a.href = href
    a.className = `hp-btn hp-btn--sm hp-btn--${kind}`
    a.textContent = label
    return a
  }
  const say = (sentence: string, ...actions: HTMLElement[]) => {
    const p = document.createElement('p')
    p.textContent = sentence
    const row = document.createElement('div')
    row.append(...actions)
    answer.replaceChildren(p, ...(actions.length ? [row] : []))
  }

  /*
   * `submitted` is Enter, the button or a chip; otherwise this is the pause after typing. The only
   * difference is what happens when nothing matches: mid-sentence we stay quiet rather than telling
   * someone we don't understand a question they haven't finished asking.
   */
  const route = (submitted: boolean) => {
    const text = input.value.trim()
    if (!text) {
      if (submitted) say('Tell us who you are, or what you need — a few words is enough.')
      else answer.replaceChildren()
      return
    }
    const match = matchIntent(text)
    if (!match) {
      if (!submitted && text.length < LIVE_MIN_CHARS) return
      say(
        'We can’t tell from that which side you’re on. Almost everyone here is one of these two:',
        button('I coach a team', '/login?intent=team', 'primary'),
        button('I represent a company', '/login?intent=company', 'outline'),
      )
      return
    }
    const actions = [button(match.intent.cta, match.intent.href, 'primary')]
    // A close second: offer the other reading instead of quietly picking one.
    if (match.runnerUp) actions.push(button(match.runnerUp.also, match.runnerUp.href, 'outline'))
    say(match.intent.text, ...actions)
  }

  let timer = 0
  const submit = () => {
    clearTimeout(timer)
    route(true)
  }
  const offs: Cleanup[] = [
    () => clearTimeout(timer),
    on(input, 'input', () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => route(false), TYPING_PAUSE)
    }),
    on(form, 'submit', (e: SubmitEvent) => {
      e.preventDefault()
      submit()
    }),
  ]
  root.querySelectorAll<HTMLButtonElement>('[data-hp-chip]').forEach((b) =>
    offs.push(
      on(b, 'click', () => {
        input.value = b.dataset.hpChip!
        submit()
      }),
    ),
  )
  return () => offs.forEach((f) => f())
}
