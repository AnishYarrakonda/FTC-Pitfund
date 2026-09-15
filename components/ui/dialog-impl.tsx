'use client'

import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/*
 * The Radix half of the overlay system, loaded by ./dialog.tsx the first time an overlay opens
 * (or its trigger is hovered or focused). Radix provides the focus trap, Esc, scroll lock and
 * aria-labelledby; ./dialog.tsx owns the open state and the trigger.
 */

export const dialogWidths = { sm: 'w-[min(400px,calc(100vw-32px))]', md: 'w-[min(560px,calc(100vw-32px))]', lg: 'w-[min(720px,calc(100vw-32px))]' }

export type OverlayContentProps = {
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

function DialogContentImpl({
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
  dismissible = true,
  returnFocus,
}: OverlayContentProps & { size?: keyof typeof dialogWidths; returnFocus: (e: Event) => void }) {
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
          onCloseAutoFocus={returnFocus}
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

function SheetContentImpl({ title, description, children, footer, className, dismissible = true, returnFocus }: OverlayContentProps & { returnFocus: (e: Event) => void }) {
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
        onCloseAutoFocus={returnFocus}
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

export type OverlayImplProps = OverlayContentProps & {
  kind: 'dialog' | 'sheet'
  size?: keyof typeof dialogWidths
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Radix returns focus to its own Trigger, which isn't rendered here; this focuses ours. */
  returnFocus: (e: Event) => void
}

export default function OverlayImpl({ kind, open, onOpenChange, ...props }: OverlayImplProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {kind === 'sheet' ? <SheetContentImpl {...props} /> : <DialogContentImpl {...props} />}
    </DialogPrimitive.Root>
  )
}
