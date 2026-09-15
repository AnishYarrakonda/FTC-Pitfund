import Link from 'next/link'

import { cn } from '@/lib/shared/cn'

/** The FTC Pitfund wordmark: a small pine mark and the name. No logo art. */
export function Wordmark({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex shrink-0 items-center gap-2 rounded-control text-body font-semibold tracking-tight whitespace-nowrap text-text', className)}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none">
        <rect width="20" height="20" rx="5" fill="var(--color-accent)" />
        <path d="M6 14.5V5.5h4.6a3.1 3.1 0 0 1 0 6.2H8.4" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      FTC Pitfund
    </Link>
  )
}
