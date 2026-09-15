import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/* Page layout primitives: widths and the page header pattern (plan §7 "Layout"). */

const widths = {
  app: 'max-w-app',
  form: 'max-w-form',
  reading: 'max-w-reading',
  review: 'max-w-review',
}

export function PageContainer({ width = 'app', children, className }: { width?: keyof typeof widths; children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full min-w-0 px-4 pt-8 pb-16 sm:px-6 sm:pt-10 lg:px-8', widths[width], className)}>{children}</div>
}

/** Title (h1), one-line description, primary action right-aligned (stacks on mobile). */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-8', className)}>
      <div className="grid min-w-0 gap-1.5">
        {eyebrow ? <div className="text-small font-medium text-text-tertiary">{eyebrow}</div> : null}
        <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">{title}</h1>
        {description ? <p className="max-w-reading text-body text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

/** A titled region inside a page: hierarchy by type and spacing, not boxes. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h2 className="text-lead font-semibold tracking-tight text-text">{title}</h2>
          {description ? <p className="text-body text-text-secondary">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
