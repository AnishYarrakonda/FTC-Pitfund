import { initGlobes, initLines } from './canvases'
import { buildDialog } from './dialogs'
import type { BentoKey } from '../content'
import { type Cleanup, on } from './util'

/*
 * Bento cards: the border glow follows the pointer (CSS reads --mx/--my); click opens the card's dialog.
 * Dialogs open from cards, from "More to discover" inside another dialog, and from #bento-* links
 * anywhere on the page (the nav menus and footer use them). The verified card tilts toward the pointer.
 */
export function initBento(root: HTMLElement): Cleanup {
  const offs: Cleanup[] = []
  const dialogs = new Map<string, HTMLDialogElement>()
  let opener: HTMLElement | null = null

  const wireDialog = (d: HTMLDialogElement) => {
    offs.push(
      on(d, 'close', () => {
        if ([...dialogs.values()].some((x) => x.open)) return
        document.documentElement.style.overflow = ''
        opener?.focus({ preventScroll: true })
        if (location.hash.startsWith('#bento-')) history.replaceState(null, '', location.pathname + location.search)
      }),
    )
    // A click on the backdrop (outside the sheet) closes.
    offs.push(on(d, 'click', (e: MouseEvent) => e.target === d && d.close()))
    d.querySelectorAll('[data-hp-dialog-close]').forEach((b) => offs.push(on(b, 'click', () => d.close())))
    d.querySelectorAll<HTMLElement>('[data-hp-open]').forEach((b) => offs.push(on(b, 'click', () => openDialog(b.dataset.hpOpen!))))
  }

  const openDialog = (key: string, from?: HTMLElement | null) => {
    if (!document.getElementById(`bento-${key}`)) return
    let d = dialogs.get(key)
    if (!d) {
      d = buildDialog(key as BentoKey)
      root.append(d)
      dialogs.set(key, d)
      wireDialog(d)
      offs.push(() => d!.remove())
    }
    dialogs.forEach((o) => o.open && o !== d && o.close())
    opener = from ?? (document.activeElement as HTMLElement | null)
    const panel = d.querySelector<HTMLElement>('[data-hp-dialog-panel]')
    if (panel && !panel.childElementCount) {
      const art = document.getElementById(`bento-${key}`)?.querySelector('.hp-g')
      if (art) {
        panel.append(art.cloneNode(true))
        panel.dataset.play = ''
        offs.push(initGlobes(panel), initLines(panel), wireTilt(panel))
      }
    }
    if (!d.open) d.showModal()
    d.scrollTop = 0
    document.documentElement.style.overflow = 'hidden'
  }

  // Card graphics play their entrance (bars grow, meters fill) the first time a card is on screen.
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        ;(e.target as HTMLElement).dataset.inview = 'true'
        io.unobserve(e.target)
      }),
    { threshold: 0.3 },
  )
  offs.push(() => io.disconnect())
  root.querySelectorAll<HTMLButtonElement>('[data-hp-bento]').forEach((card) => {
    io.observe(card)
    offs.push(
      on(card, 'pointermove', (e: PointerEvent) => {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${e.clientX - r.left}px`)
        card.style.setProperty('--my', `${e.clientY - r.top}px`)
      }),
    )
    offs.push(on(card, 'click', () => openDialog(card.dataset.hpBento!, card)))
  })

  // #bento-* links open the matching dialog instead of just scrolling.
  offs.push(
    on(document, 'click', (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href^="#bento-"]') as HTMLAnchorElement | null
      if (!a) return
      e.preventDefault()
      const key = a.getAttribute('href')!.slice(7)
      document.getElementById(`bento-${key}`)?.scrollIntoView({ block: 'center' })
      openDialog(key, document.getElementById(`bento-${key}`))
    }),
  )
  if (location.hash.startsWith('#bento-')) openDialog(location.hash.slice(7), document.getElementById(location.hash.slice(1)))

  offs.push(wireTilt(root))

  return () => {
    offs.forEach((f) => f())
    document.documentElement.style.overflow = ''
  }
}

/** The verified card tilts toward the pointer, with a sheen that follows it. */
function wireTilt(scope: HTMLElement): Cleanup {
  const offs: Cleanup[] = []
  scope.querySelectorAll<HTMLElement>('[data-hp-tilt]').forEach((card) => {
    const host = card.closest('button, .hp-dialog__panel') as HTMLElement | null
    if (!host) return
    offs.push(
      on(host, 'pointermove', (e: PointerEvent) => {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        card.style.transform = `perspective(900px) rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`
        card.style.setProperty('--shine-x', `${(x + 0.5) * 100}%`)
      }),
    )
    offs.push(on(host, 'pointerleave', () => (card.style.transform = '')))
  })
  return () => offs.forEach((f) => f())
}
