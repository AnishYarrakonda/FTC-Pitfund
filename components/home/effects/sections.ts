import { initBurst } from './canvases'
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
  const btn = sec.querySelector<HTMLButtonElement>('[data-hp-time-btn]')!
  const menu = sec.querySelector<HTMLElement>('[data-hp-time-menu]')!
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

/* Keyword routing for "Find where to start". Nothing leaves the page. */
const ROUTES: Array<{ test: RegExp; text: string; href: string; cta: string }> = [
  { test: /compan|sponsor|business|employer|corporat|donat|fund(ing)? teams|we give|philanthropy|grant|csr|charity|partner|invest|support|give back|foundation/i, text: 'Sounds like you represent a company. Set up your profile and questions; a reviewer approves you before teams can pitch.', href: '/login?intent=company', cta: 'Set up your company' },
  { test: /free|cost|price|pay|fee|money|charge|subscription|credit card|billing|invoice|dollar|budget|expense|finance|how much/i, text: 'It’s free for teams and companies, and no money moves through FTC Pitfund. Sponsorships are arranged directly between you.', href: '#faq', cta: 'Read the FAQ' },
  { test: /review|check|approve|reject|note|vet|screen|quality|feedback|edit|proofread|human|admin|moderator/i, text: 'A person reads every pitch before a company sees it, and sends it back with a note if something needs work.', href: '#bento-review', cta: 'How review works' },
  { test: /student|kid|child|member|youth|teen|high school|middle school|under 18|minor/i, text: 'Accounts are for adults: coaches, mentors and parents. Students are represented by the team page and deck.', href: '#faq', cta: 'Read the FAQ' },
  { test: /deck|pdf|slides|page|presentation|document|file|upload|size|format|template|example|portfolio|brochure|design/i, text: 'Decks are one PDF of up to five pages. Our guide shows what each page should do.', href: '#guide', cta: 'Read the deck guide' },
  { test: /privac|safe|secur|data|share|contact|email|phone|address|spam|protect/i, text: 'Contact details are kept completely private until a match is made. No one can see your email until you both say yes.', href: '#faq', cta: 'Read the FAQ' },
  { test: /coach|team|mentor|parent|robot|ftc|pitch|field|kit|travel|parts|first tech challenge|first robotics|competition|season|championship|worlds|state|regional|qualifier|outreach|stem|build|programming|java|blocks/i, text: 'Sounds like you coach a team. Verify your team, upload your deck, and pitch any approved company.', href: '/login?intent=team', cta: 'I coach a team' },
]

export function initFind(root: HTMLElement): Cleanup {
  const form = root.querySelector<HTMLFormElement>('[data-hp-find]')
  if (!form) return () => {}
  const input = form.querySelector<HTMLTextAreaElement>('[data-hp-find-input]')!
  const count = form.querySelector<HTMLElement>('[data-hp-find-count]')!
  const ring = form.querySelector<HTMLElement>('[data-hp-find-ring]')!
  const answer = root.querySelector<HTMLElement>('[data-hp-find-answer]')!
  const refresh = () => {
    count.textContent = `${input.value.length}/500`
    ring.style.setProperty('--p', String(Math.min(1, input.value.trim().split(/\s+/).filter(Boolean).length / 12)))
    form.dataset.filled = String(input.value.trim().length > 0)
  }
  const route = () => {
    const text = input.value.trim()
    const hit = ROUTES.find((r) => r.test.test(text))
    answer.textContent = ''
    const p = document.createElement('p')
    const a = document.createElement('a')
    if (!text) {
      p.textContent = 'Tell us a little first: who you are, or what you’re trying to do.'
      answer.append(p)
      return
    }
    p.textContent = hit ? hit.text : 'We couldn’t tell which side you’re on. Coaches start here; companies use the other door.'
    a.href = hit ? hit.href : '/login?intent=team'
    a.className = 'hp-btn hp-btn--sm hp-btn--primary'
    a.textContent = hit ? hit.cta : 'I coach a team'
    answer.append(p, a)
    if (!hit) {
      const b = document.createElement('a')
      b.href = '/login?intent=company'
      b.className = 'hp-btn hp-btn--sm hp-btn--secondary'
      b.textContent = 'I represent a company'
      answer.append(b)
    }
    answer.dataset.shown = 'true'
  }
  const offs = [
    on(input, 'input', refresh),
    on(form, 'submit', (e: SubmitEvent) => {
      e.preventDefault()
      route()
    }),
    on(input, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        route()
      }
    }),
  ]
  form.querySelectorAll<HTMLButtonElement>('[data-hp-chip]').forEach((b) =>
    offs.push(
      on(b, 'click', () => {
        input.value = b.dataset.hpChip!
        refresh()
        route()
      }),
    ),
  )
  refresh()
  return () => offs.forEach((f) => f())
}
