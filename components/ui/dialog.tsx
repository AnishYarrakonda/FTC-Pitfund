'use client'

import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useState, type ReactNode } from 'react'

import { useAction } from '@/lib/client/use-action'
import { cn } from '@/lib/shared/cn'
import type { Result } from '@/lib/shared/result'

import { Button } from './button'

/*
 * The overlay system (plan §7). Fixes the v1 thin-panel bug class:
 *   Dialog  sm 400 · md 560 · lg 720, width min(size, 100vw − 32px),
 *           max-height min(85vh, 100dvh − 32px); header and footer stay put, only the body scrolls.
 *   Sheet   right side, min(640px, 100vw); full screen below 640 px; same structure.
 * Radix provides the focus trap, Esc, focus return, scroll lock and aria-labelledby.
 * Anything bigger than a short form or a paragraph is a page, not an overlay.
 */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const dialogWidths = { sm: 'w-[min(400px,calc(100vw-32px))]', md: 'w-[min(560px,calc(100vw-32px))]', lg: 'w-[min(720px,calc(100vw-32px))]' }

type OverlayContentProps = {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
  /** Prevent closing by clicking outside or pressing Esc (e.g. while an action is pending). */
  dismissible?: boolean
}

function OverlayHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
      <div className="grid min-w-0 gap-1">
        <DialogPrimitive.Title className="text-lead font-semibold tracking-tight text-text">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="text-body text-text-secondary">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close asChild>
        <button
          type="button"
          data-overlay-close=""
          aria-label="Close"
          className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-control text-text-tertiary transition-colors duration-120 hover:bg-muted hover:text-text"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </DialogPrimitive.Close>
    </div>
  )
}

function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
      {children}
    </div>
  )
}

function Overlay() {
  return (
    <DialogPrimitive.Overlay
      data-motion="overlay"
      className="fixed inset-0 z-50 bg-text/30 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out"
    />
  )
}

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
  dismissible = true,
}: OverlayContentProps & { size?: keyof typeof dialogWidths }) {
  const block = (e: Event) => {
    if (!dismissible) e.preventDefault()
  }
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
        <DialogPrimitive.Content
          data-overlay="dialog"
          data-size={size}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          className={cn(
            'pointer-events-auto flex max-h-[min(85vh,calc(100dvh-32px))] min-w-0 flex-col overflow-hidden rounded-dialog border border-border bg-surface shadow-lg',
            'data-[state=open]:animate-content-in data-[state=closed]:animate-content-out focus:outline-none',
            dialogWidths[size],
            className,
          )}
        >
          <OverlayHeader title={title} description={description} />
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div> : null}
          {footer ? <OverlayFooter>{footer}</OverlayFooter> : null}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  )
}

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger

export function SheetContent({ title, description, children, footer, className, dismissible = true }: OverlayContentProps) {
  const block = (e: Event) => {
    if (!dismissible) e.preventDefault()
  }
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        data-overlay="sheet"
        onEscapeKeyDown={block}
        onPointerDownOutside={block}
        onInteractOutside={block}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-screen min-w-0 flex-col bg-surface shadow-lg sm:w-[min(640px,100vw)] sm:border-l sm:border-border',
          'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out focus:outline-none',
          className,
        )}
      >
        <OverlayHeader title={title} description={description} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <OverlayFooter>{footer}</OverlayFooter> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

type ConfirmDialogProps<T> = {
  trigger: ReactNode
  title: ReactNode
  /** One sentence stating the consequence (plan §3.1 #7). */
  consequence: ReactNode
  confirmLabel: string
  pendingLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  onConfirm: () => Promise<Result<T>>
  onConfirmed?: (data: T) => void
  /** Extra content between the sentence and the buttons, e.g. a reason field. */
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Confirmation for irreversible or outward-facing actions. Stays open while the action runs
 * (and can't be dismissed mid-flight), shows failures inside the dialog, closes on success.
 */
export function ConfirmDialog<T>({
  trigger,
  title,
  consequence,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onConfirmed,
  children,
  open: controlledOpen,
  onOpenChange,
}: ConfirmDialogProps<T>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (controlledOpen === undefined) setUncontrolledOpen(next)
  }
  const { run, pending, error, reset } = useAction(onConfirm, {
    errorToast: false,
    onSuccess: (data) => {
      setOpen(false)
      onConfirmed?.(data)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        if (!next) reset()
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        size="sm"
        title={title}
        description={consequence}
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </DialogClose>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              data-action-button=""
              loading={pending}
              loadingLabel={pendingLabel}
              onClick={() => void run(undefined)}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children || error ? (
          <div className="grid gap-4">
            {children}
            {error ? (
              <p role="alert" className="text-body text-danger">
                {error.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
