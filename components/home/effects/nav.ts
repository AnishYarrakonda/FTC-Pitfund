import { type Cleanup, on } from './util'

/*
 * Below 1024px the in-page links fold into a menu under the bar. The burger toggles it; Esc, a link
 * inside it, or widening the window past the breakpoint closes it, and Esc returns focus to the burger.
 */
export function initNav(root: HTMLElement): Cleanup {
  const nav = root.querySelector<HTMLElement>('[data-hp-nav]')
  const burger = nav?.querySelector<HTMLButtonElement>('[data-hp-burger]')
  const menu = nav?.querySelector<HTMLElement>('[data-hp-mnav]')
  if (!nav || !burger || !menu) return () => {}

  const set = (open: boolean) => {
    menu.hidden = !open
    nav.dataset.menu = open ? 'open' : 'closed'
    burger.setAttribute('aria-expanded', String(open))
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  }
  const wide = window.matchMedia('(min-width: 1024px)')
  const offs: Cleanup[] = [
    on(burger, 'click', () => set(menu.hidden)),
    on(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || menu.hidden) return
      set(false)
      burger.focus()
    }),
    on(wide, 'change', () => wide.matches && set(false)),
  ]
  menu.querySelectorAll<HTMLElement>('[data-hp-close]').forEach((a) => offs.push(on(a, 'click', () => set(false))))
  return () => offs.forEach((f) => f())
}
