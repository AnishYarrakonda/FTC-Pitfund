import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'
import { formatDateTime, formatRelative } from '@/lib/shared/format'
import type { Tone } from '@/lib/shared/labels'

/* StatusBadge, Banner, EmptyState, Timeline, KeyboardHint, Skeletons. */

const dotTone: Record<Tone, string> = {
  neutral: 'bg-text-tertiary',
  accent: 'bg-accent',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const badgeTone: Record<Tone, string> = {
  neutral: 'text-text-secondary',
  accent: 'text-accent',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

/** Dot + label. Small, status only. */
export function StatusBadge({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-small font-medium whitespace-nowrap', badgeTone[tone], className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dotTone[tone])} />
      {label}
    </span>
  )
}

const bannerStyles: Record<'info' | 'warning' | 'danger' | 'success', { box: string; icon: ReactNode }> = {
  info: { box: 'border-info/20 bg-info-subtle', icon: <Info aria-hidden="true" className="size-4 text-info" /> },
  warning: { box: 'border-warning/25 bg-warning-subtle', icon: <AlertTriangle aria-hidden="true" className="size-4 text-warning" /> },
  danger: { box: 'border-danger/20 bg-danger-subtle', icon: <XCircle aria-hidden="true" className="size-4 text-danger" /> },
  success: { box: 'border-success/20 bg-success-subtle', icon: <CheckCircle2 aria-hidden="true" className="size-4 text-success" /> },
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const style = bannerStyles[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-3 rounded-menu border px-4 py-3 sm:flex-row sm:items-center sm:justify-between', style.box, className)}
    >
      <div className="flex min-w-0 gap-3">
        <span className="mt-[3px] shrink-0">{style.icon}</span>
        <div className="grid min-w-0 gap-0.5">
          <p className="text-body font-medium text-text">{title}</p>
          {children ? <div className="text-body text-text-secondary">{children}</div> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">{action}</div> : null}
    </div>
  )
}

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
