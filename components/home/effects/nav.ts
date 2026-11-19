import { type Cleanup, on } from './util'

/*
 * The head of the page. The Product menu opens on hover (with a short grace period so the pointer can
 * cross the gap), on click and from the keyboard; Esc, a click outside or choosing an item closes it and
 * Esc returns focus to its button. Below 992px the links fold into a sheet the burger toggles. The
 * season banner can be dismissed for this page view (remembering it would mean hiding it after first
 * paint on the next one, a layout shift for everyone who closed it).
 */

export function initNav(root: HTMLElement): Cleanup {
  const nav = root.querySelector<HTMLElement>('[data-hp-nav]')
  if (!nav) return () => {}
  const offs: Cleanup[] = []

  // Burger sheet.
  const burger = nav.querySelector<HTMLButtonElement>('[data-hp-burger]')
  const sheet = nav.querySelector<HTMLElement>('[data-hp-mnav]')
  if (burger && sheet) {
    const setSheet = (open: boolean) => {
      sheet.hidden = !open
      nav.dataset.menu = open ? 'open' : 'closed'
      burger.setAttribute('aria-expanded', String(open))
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
      document.documentElement.style.overflow = open ? 'hidden' : ''
    }
    const wide = window.matchMedia('(min-width: 992px)')
    offs.push(
      on(burger, 'click', () => setSheet(sheet.hidden)),
      on(wide, 'change', () => wide.matches && setSheet(false)),
      on(document, 'keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || sheet.hidden) return
        setSheet(false)
        burger.focus()
      }),
      () => (document.documentElement.style.overflow = ''),
    )
    sheet.querySelectorAll<HTMLElement>('[data-hp-close], a').forEach((a) => offs.push(on(a, 'click', () => setSheet(false))))
  }

  // Product menu.
  const trigger = nav.querySelector<HTMLButtonElement>('[data-hp-menu-trigger]')
  const menu = nav.querySelector<HTMLElement>('[data-hp-menu]')
  if (trigger && menu) {
    const item = trigger.parentElement as HTMLElement
    let closeTimer = 0
    const setMenu = (open: boolean) => {
      window.clearTimeout(closeTimer)
      if (menu.hidden === !open) return
      menu.hidden = !open
      trigger.setAttribute('aria-expanded', String(open))
    }
    const hover = window.matchMedia('(hover: hover)')
    offs.push(
      () => window.clearTimeout(closeTimer),
      on(trigger, 'click', () => setMenu(menu.hidden)),
      on(item, 'pointerenter', (e: PointerEvent) => {
        if (e.pointerType === 'mouse' && hover.matches) setMenu(true)
      }),
      on(item, 'pointerleave', (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        window.clearTimeout(closeTimer)
        closeTimer = window.setTimeout(() => setMenu(false), 160)
      }),
      on(document, 'pointerdown', (e: PointerEvent) => {
        if (!menu.hidden && !item.contains(e.target as Node)) setMenu(false)
      }),
      on(document, 'keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || menu.hidden) return
        setMenu(false)
        trigger.focus()
      }),
      on(item, 'focusout', (e: FocusEvent) => {
        if (!item.contains(e.relatedTarget as Node | null)) setMenu(false)
      }),
      on(trigger, 'keydown', (e: KeyboardEvent) => {
        if (e.key !== 'ArrowDown') return
        e.preventDefault()
        setMenu(true)
        menu.querySelector<HTMLElement>('a')?.focus()
      }),
    )
    menu.querySelectorAll<HTMLElement>('[data-hp-menu-close]').forEach((a) => offs.push(on(a, 'click', () => setMenu(false))))
  }

  // Season banner.
  const close = root.querySelector<HTMLButtonElement>('[data-hp-banner-close]')
  if (close) {
    offs.push(
      on(close, 'click', () => {
        root.dataset.banner = 'off'
        nav.querySelector<HTMLElement>('a, button')?.focus()
      }),
    )
  }

  return () => offs.forEach((f) => f())
}
