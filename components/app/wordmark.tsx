import Link from 'next/link'

import { cn } from '@/lib/shared/cn'

/**
 * The one FTC Pitfund mark, for the homepage and the product alike.
 *
 * A hexagon encasing a spark: the hexagon is the structural, hardware side of FTC, the spark is the
 * idea, the match and the funding. Solid in the brand blue, never gradient-filled — the signature
 * gradient belongs to the homepage's artwork, and a 22 px badge is too small to read one.
 *
 * There used to be two of these that had drifted apart: a green "P" tile in the product and this
 * hexagon on the homepage, with different geometry and a different wordmark. `MarkGlyph` is now the
 * single source for the artwork; the homepage's `Mark` and this `Wordmark` both draw it.
 */
export function MarkGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <polygon points="16,6 25,11 25,21 16,26 7,21 7,11" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 10 C16 14.5 14.5 16 10 16 C14.5 16 16 17.5 16 22 C16 17.5 17.5 16 22 16 C17.5 16 16 14.5 16 10 Z" fill="#fff" />
    </svg>
  )
}

/** The mark plus the name, as it sits in the product's headers and on the auth pages. */
export function Wordmark({ href = '/', className, dark = false }: { href?: string; className?: string; dark?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center gap-[7px] rounded-control text-[17px] leading-none font-semibold tracking-[-0.04em] whitespace-nowrap',
        dark ? 'text-white' : 'text-text',
        className,
      )}
    >
      <MarkGlyph className={cn('size-[22px] shrink-0', dark ? 'text-white/95' : 'text-accent')} />
      pitfund
    </Link>
  )
}
