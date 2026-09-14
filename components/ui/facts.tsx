import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

import type { Tone } from '@/lib/shared/labels'

/* Facts (label/value rows) and Meter (used / limit). Quiet, precise, no charts. */

export function Facts({ rows, className }: { rows: Array<{ label: string; value: ReactNode } | null | false>; className?: string }) {
  return (
    <dl className={cn('grid divide-y divide-border', className)}>
      {rows.filter(Boolean).map((row) => {
        const { label, value } = row as { label: string; value: ReactNode }
        return (
          <div key={label} className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-small text-text-tertiary">{label}</dt>
            <dd className="min-w-0 text-small text-text user-text">{value}</dd>
          </div>
        )
      })}
    </dl>
  )
}

const meterTone: Record<Extract<Tone, 'accent' | 'warning' | 'danger'>, string> = {
  accent: 'bg-accent',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/** A thin used/limit bar. Turns warning at `warnAt` and danger at `dangerAt` (fractions of the limit). */
export function Meter({
  label,
  used,
  limit,
  display,
  warnAt = 0.8,
  dangerAt = 0.95,
  className,
}: {
  label: string
  used: number
  limit: number
  display: ReactNode
  warnAt?: number
  dangerAt?: number
  className?: string
}) {
  const fraction = limit > 0 ? Math.min(1, used / limit) : 0
  const tone = fraction >= dangerAt ? 'danger' : fraction >= warnAt ? 'warning' : 'accent'
  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="text-small text-text-secondary">{label}</span>
        <span className={cn('text-body font-medium tabular', tone === 'accent' ? 'text-text' : tone === 'warning' ? 'text-warning' : 'text-danger')}>{display}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full', meterTone[tone])} style={{ width: `${Math.max(fraction * 100, used > 0 ? 1.5 : 0)}%` }} />
      </div>
    </div>
  )
}
