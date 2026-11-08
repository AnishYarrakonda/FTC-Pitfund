import { matchIntent } from './find-match'
import { type Cleanup, on } from './util'

/* The stage accordion and the "find where to start" box. */

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
