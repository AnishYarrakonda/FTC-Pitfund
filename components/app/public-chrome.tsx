import Link from 'next/link'
import type { ReactNode } from 'react'

import { FIRST_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/shared/brand'
import { cn } from '@/lib/shared/cn'

import { Wordmark } from './wordmark'

export function PublicHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-app items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark />
        {action}
      </div>
    </header>
  )
}

export function PublicFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('border-t border-border', className)}>
      <div className="mx-auto flex w-full max-w-app flex-col gap-4 px-4 py-8 text-small text-text-tertiary sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          © {2026} FTC Pitfund · {FIRST_DISCLAIMER}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/legal/terms" className="hover:text-text">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-text">
            Privacy
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-text">
            {SUPPORT_EMAIL}
          </a>
        </nav>
      </div>
    </footer>
  )
}
