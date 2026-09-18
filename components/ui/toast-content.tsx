'use client'

import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/shared/cn'

/*
 * The body of every toast. Sonner is unstyled (components/ui/sonner-toaster.tsx), so this is the
 * whole visual: icon, text, optional action, a dismiss button, and a bar along the bottom that
 * drains left to right for exactly as long as the toast will live.
 *
 * The bar is a CSS animation rather than a timer: it is driven by the same duration Sonner was
 * given, so the two can't drift, and it costs no JavaScript while it runs. Sonner pauses its
 * dismiss timer while a toast is hovered or focused; the bar pauses with it (see globals.css).
 */

export type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'loading'

const ICONS: Record<Exclude<ToastKind, 'loading'>, typeof Check> = {
  success: Check,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const ICON_TONE: Record<Exclude<ToastKind, 'loading'>, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
}

export type ToastAction = { label: string; onClick: () => void }

export function ToastContent({
  kind,
  title,
  description,
  action,
  durationMs,
  onDismiss,
}: {
  kind: ToastKind
  title: ReactNode
  description?: ReactNode
  action?: ToastAction
  /** Infinity for a toast that stays until something replaces it (signing out, navigating away). */
  durationMs: number
  onDismiss: () => void
}) {
  // "loading" is not an outcome: it has no decay bar and no dismiss, because the thing it reports
  // is still happening and closing it wouldn't stop it.
  const transient = kind === 'loading'
  const Icon = transient ? null : ICONS[kind]
  return (
    <div className="pitfund-toast relative flex w-[min(380px,calc(100vw-32px))] items-start gap-3 overflow-hidden rounded-menu border border-border bg-surface py-3 pr-2 pl-4 text-body text-text shadow-sm">
      {Icon ? (
        <Icon aria-hidden="true" className={cn('mt-[3px] size-4 shrink-0', ICON_TONE[kind as Exclude<ToastKind, 'loading'>])} />
      ) : (
        <Spinner className="mt-[3px] size-4 shrink-0" />
      )}
      <div className="grid min-w-0 flex-1 gap-0.5 pb-0.5">
        <p className="min-w-0 font-medium text-text">{title}</p>
        {description ? <p className="min-w-0 text-small text-text-secondary">{description}</p> : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={() => {
            action.onClick()
            onDismiss()
          }}
          className="mt-px shrink-0 rounded-control border border-border-strong bg-surface px-2.5 py-1 text-small font-medium text-text transition-colors duration-120 hover:bg-muted"
        >
          {action.label}
        </button>
      ) : null}
      {transient ? (
        <span className="w-2" />
      ) : (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mt-0.5 -mr-0.5 grid size-8 shrink-0 place-items-center rounded-control text-text-tertiary transition-colors duration-120 hover:bg-muted hover:text-text"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
      {transient || !Number.isFinite(durationMs) ? null : (
        <span
          aria-hidden="true"
          className="pitfund-toast-decay absolute inset-x-0 bottom-0 h-0.5 origin-left bg-border-strong"
          style={{ animationDuration: `${durationMs}ms` }}
        />
      )}
    </div>
  )
}
