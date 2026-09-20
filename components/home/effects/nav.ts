import { type Cleanup, on } from './util'

/*
 * Desktop: hover (or click) a trigger to open its panel under the bar; moving to another trigger slides
 * the old panel out and the new one in from the side you moved toward; leaving the bar and panel closes
 * it after a short grace period; Esc closes and returns focus. Mobile: the burger opens a full-screen
 * sheet and locks page scroll.
 */
export function initNav(root: HTMLElement): Cleanup {
  const nav = root.querySelector<HTMLElement>('[data-hp-nav]')
  if (!nav) return () => {}
  const popup = nav.querySelector<HTMLElement>('[data-hp-popup]')!
  const triggers = [...nav.querySelectorAll<HTMLButtonElement>('[data-hp-trigger]')]
  const panels = new Map([...nav.querySelectorAll<HTMLElement>('[data-hp-panel]')].map((p) => [p.dataset.hpPanel!, p]))
  const keys = triggers.map((t) => t.dataset.hpTrigger!)
  let current: string | null = null
  let closeTimer = 0
  const offs: Cleanup[] = []

  const open = (key: string) => {
    window.clearTimeout(closeTimer)
    if (current === key) return
    const prev = current
    const dir = prev === null ? 0 : keys.indexOf(key) > keys.indexOf(prev) ? 1 : -1
    current = key
    nav.dataset.open = 'true'
    popup.dataset.status = 'open'
    triggers.forEach((t) => t.setAttribute('aria-expanded', String(t.dataset.hpTrigger === key)))
    panels.forEach((p, k) => {
      p.dataset.dir = String(dir)
      if (k === key) {
        p.dataset.state = 'entering'
        requestAnimationFrame(() => (p.dataset.state = 'open'))
      } else if (k === prev) p.dataset.state = 'leaving'
      else p.dataset.state = 'closed'
    })
    const panel = panels.get(key)!
    popup.style.setProperty('--panel-h', `${panel.scrollHeight}px`)
  }
  const close = () => {
    window.clearTimeout(closeTimer)
    if (current === null) return
    current = null
    delete nav.dataset.open
    popup.dataset.status = 'closed'
    triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'))
    panels.forEach((p) => (p.dataset.state = 'closed'))
  }
  const closeSoon = () => {
    window.clearTimeout(closeTimer)
    closeTimer = window.setTimeout(close, 180)
  }

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
  for (const t of triggers) {
    const key = t.dataset.hpTrigger!
    offs.push(on(t, 'pointerenter', () => fine.matches && open(key)))
    offs.push(on(t, 'click', () => (current === key ? close() : open(key))))
    offs.push(
      on(t, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          open(key)
          panels.get(key)?.querySelector<HTMLElement>('a')?.focus()
        }
      }),
    )
  }
  const bar = nav.querySelector<HTMLElement>('.hp-nav__bar')!
  offs.push(on(bar, 'pointerleave', () => fine.matches && closeSoon()))
  offs.push(on(bar, 'pointerenter', () => window.clearTimeout(closeTimer)))
  nav.querySelectorAll<HTMLElement>('.hp-nav__trigger--link, .hp-nav__logo, .hp-nav__actions').forEach((el) => offs.push(on(el, 'pointerenter', () => fine.matches && closeSoon())))
  offs.push(on(nav.querySelector('[data-hp-scrim]')!, 'click', close))
  offs.push(
    on(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (current) {
        const t = triggers.find((x) => x.dataset.hpTrigger === current)
        close()
        t?.focus()
      }
      if (!sheet.hidden) setSheet(false)
    }),
  )
  offs.push(
    on(document, 'focusin', (e: FocusEvent) => {
      if (current && !bar.contains(e.target as Node)) close()
    }),
  )

  // Mobile sheet
  const sheet = nav.querySelector<HTMLElement>('[data-hp-mnav]')!
  const burger = nav.querySelector<HTMLButtonElement>('[data-hp-burger]')!
  const list = sheet.querySelector<HTMLElement>('[data-hp-mnav-list]')!
  const fillSheet = () => {
    if (list.querySelector('details')) return
    const groups = triggers.map((t) => {
      const li = document.createElement('li')
      const details = document.createElement('details')
      details.className = 'hp-mnav__group'
      const summary = document.createElement('summary')
      summary.textContent = t.textContent
      const chev = t.querySelector('svg')?.cloneNode(true) as SVGElement | undefined
      if (chev) {
        chev.setAttribute('class', 'hp-mnav__chev')
        summary.append(chev)
      }
      const ul = document.createElement('ul')
      panels.get(t.dataset.hpTrigger!)?.querySelectorAll('.hp-nav__list > li').forEach((item) => ul.append(item.cloneNode(true)))
      details.append(summary, ul)
      li.append(details)
      return li
    })
    list.prepend(...groups)
    list.querySelectorAll('[data-hp-close]').forEach((a) => offs.push(on(a, 'click', () => setSheet(false))))
  }
  const setSheet = (openIt: boolean) => {
    if (openIt) fillSheet()
    sheet.hidden = !openIt
    burger.setAttribute('aria-expanded', String(openIt))
    document.documentElement.style.overflow = openIt ? 'hidden' : ''
    if (openIt) sheet.querySelector<HTMLElement>('[data-hp-burger-close]')?.focus()
    else burger.focus({ preventScroll: true })
  }
  offs.push(on(burger, 'click', () => setSheet(true)))
  offs.push(on(sheet.querySelector('[data-hp-burger-close]')!, 'click', () => setSheet(false)))
  nav.querySelectorAll('[data-hp-close]').forEach((a) =>
    offs.push(
      on(a, 'click', () => {
        close()
        if (!sheet.hidden) setSheet(false)
      }),
    ),
  )

  return () => {
    offs.forEach((f) => f())
    document.documentElement.style.overflow = ''
  }
}
