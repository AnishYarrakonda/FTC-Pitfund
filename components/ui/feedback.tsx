import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'
import { formatDateTime, formatRelative } from '@/lib/shared/format'
import type { Tone } from '@/lib/shared/labels'

import { dotTone } from './status-badge'

/* EmptyState, Timeline, KeyboardHint, Skeletons; re-exports Banner and StatusBadge, which live in
   their own modules so client components can import them without the rest of this file. */
export { Banner } from './banner'
export { StatusBadge } from './status-badge'

/** One sentence on what goes here plus the single next step (plan §3.1 #9). */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? (
        <span className="mb-4 grid size-10 place-items-center rounded-menu border border-border bg-surface text-text-tertiary [&_svg]:size-4.5">
          {icon}
        </span>
      ) : null}
      <h2 className="text-lead font-semibold tracking-tight text-text">{title}</h2>
      {description ? <p className="mt-1.5 max-w-sm text-body text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export type TimelineEvent = {
  id: string
  title: ReactNode
  description?: ReactNode
  at: Date | string
  tone?: Tone
}

export function Timeline({ events, className, now }: { events: TimelineEvent[]; className?: string; now?: Date }) {
  return (
    <ol className={cn('grid', className)}>
      {events.map((event, index) => {
        const last = index === events.length - 1
        const date = typeof event.at === 'string' ? new Date(event.at) : event.at
        return (
          <li key={event.id} className="relative grid grid-cols-[16px_1fr] gap-x-3">
            <span aria-hidden="true" className="relative flex justify-center">
              <span className={cn('relative z-10 mt-[7px] size-2 rounded-full ring-4 ring-surface', dotTone[event.tone ?? 'neutral'])} />
              {!last ? <span className="absolute top-[15px] bottom-0 w-px bg-border" /> : null}
            </span>
            <div className={cn('min-w-0', !last && 'pb-5')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="min-w-0 text-body font-medium text-text">{event.title}</p>
                <time dateTime={date.toISOString()} title={formatDateTime(date)} className="text-small text-text-tertiary tabular whitespace-nowrap">
                  {formatRelative(date, now)}
                </time>
              </div>
              {event.description ? <div className="mt-0.5 text-body text-text-secondary user-text-block">{event.description}</div> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function KeyboardHint({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-grid h-5 min-w-5 place-items-center rounded-[4px] border border-border-strong bg-surface px-1 font-sans text-caption font-medium text-text-secondary shadow-[0_1px_0_var(--color-border-strong)]"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-control bg-muted', className)} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid gap-2.5', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </span>
  )
}

/** A list of rows shaped like the real list rows: logo, two lines, a status. */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('divide-y divide-border rounded-menu border border-border bg-surface', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-10 rounded-menu" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  )
}

export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action ? <Skeleton className="h-9 w-32" /> : null}
    </div>
  )
}
