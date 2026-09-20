import type { SVGProps } from 'react'

import { MarkGlyph } from '@/components/app/wordmark'

/* Small line icons for the homepage, drawn at 24px on a 1.6 stroke like the reference's product icons. */

type P = SVGProps<SVGSVGElement>
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/** The link arrow: a chevron whose stem draws in on hover (see .hp-arrow). */
export function Arrow() {
  return (
    <svg className="hp-arrow" viewBox="0 0 10 10" aria-hidden="true">
      <path className="hp-arrow__stem" d="M0.5 5h6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path className="hp-arrow__head" d="M1.5 1.5 5 5l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Chevron(p: P) {
  return (
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" {...p}>
      <path d="M2 3.5 5 6.5l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const I = {
  file: (p: P) => (
    <svg {...base} {...p}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4M9 13h6M9 16h4" />
    </svg>
  ),
  eye: (p: P) => (
    <svg {...base} {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  ),
  send: (p: P) => (
    <svg {...base} {...p}>
      <path d="M21 3 3 10.5l7.2 2.7L13 20.5 21 3Z" />
      <path d="M21 3 10.2 13.2" />
    </svg>
  ),
  check: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3 10.8 15 16 9.3" />
    </svg>
  ),
  shield: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3.5 5 6v6c0 4.4 3 7.6 7 8.5 4-.9 7-4.1 7-8.5V6l-7-2.5Z" />
      <path d="M9 12.2 11.3 14.5 15.5 10" />
    </svg>
  ),
  users: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.6-3 2.7-4.7 5.5-4.7s4.9 1.7 5.5 4.7M15.5 6a3 3 0 0 1 0 5.8M18 19c-.4-2-1.4-3.5-3-4.3" />
    </svg>
  ),
  user: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" />
    </svg>
  ),
  mail: (p: P) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.8" />
      <path d="M4.5 7 12 12.5 19.5 7" />
    </svg>
  ),
  lock: (p: P) => (
    <svg {...base} {...p}>
      <rect x="5" y="10.5" width="14" height="9" rx="1.8" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  ),
  gauge: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4.5 17.5a8.5 8.5 0 1 1 15 0" />
      <path d="m12 13 3.5-4" />
    </svg>
  ),
  loop: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 10V8a2 2 0 0 1 2-2h11l-3-3M20 14v2a2 2 0 0 1-2 2H7l3 3" />
    </svg>
  ),
  grid: (p: P) => (
    <svg {...base} {...p}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <path d="M16.75 4v6.5M13.5 7.25H20" />
    </svg>
  ),
  question: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 20.5a8.5 8.5 0 1 0-7.4-4.3L3.5 20.5l4.3-1.1a8.5 8.5 0 0 0 4.2 1.1Z" />
      <path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.5M12 16.2v.1" />
    </svg>
  ),
  flag: (p: P) => (
    <svg {...base} {...p}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  ),
  bolt: (p: P) => (
    <svg {...base} {...p}>
      <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
    </svg>
  ),
  trend: (p: P) => (
    <svg {...base} {...p}>
      <path d="M3.5 16.5 9 11l4 4 7.5-7.5M15 7.5h5.5V13" />
    </svg>
  ),
  book: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
    </svg>
  ),
  sparkle: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3.5c.5 3.8 2.2 5.6 6 6-3.8.5-5.5 2.2-6 6-.5-3.8-2.2-5.5-6-6 3.8-.4 5.5-2.2 6-6ZM18.5 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" />
    </svg>
  ),
  sun: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  ),
  expand: (p: P) => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      <path d="M9.5 3H13v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 13H3V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (p: P) => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  close: (p: P) => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  left: (p: P) => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      <path d="M13 8H3.5M7.5 4 3.5 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  right: (p: P) => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      <path d="M3 8h9.5M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  up: (p: P) => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      <path d="M8 13V3.5M4 7.5l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  menu: (p: P) => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...p}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  tick: (p: P) => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...p}>
      <circle cx="8" cy="8" r="8" fill="currentColor" opacity=".18" />
      <path d="m4.8 8.2 2 2 4.4-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

/** The FTC Pitfund mark, drawn in the homepage's ink color like the reference's wordmark. */
export function Mark({ className }: { className?: string }) {
  return (
    <span className={`hp-mark ${className ?? ''}`}>
      <MarkGlyph />
      <span>pitfund</span>
    </span>
  )
}
