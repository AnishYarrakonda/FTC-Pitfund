import { cn } from '@/lib/shared/cn'
import type { Tone } from '@/lib/shared/labels'

export const dotTone: Record<Tone, string> = {
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
