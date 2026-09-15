import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/* Banner: an inline notice with an optional action (info, warning, danger, success). */

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

