'use client'

import { Slot } from 'radix-ui'
import { createContext, use, useCallback, useRef, useState, type ComponentType, type ReactNode } from 'react'

import { useAction } from '@/lib/client/use-action'
import type { Result } from '@/lib/shared/result'

import { Button } from './button'
import type { dialogWidths, OverlayContentProps, OverlayImplProps } from './dialog-impl'

/*
 * The overlay system (plan §7). Fixes the v1 thin-panel bug class:
 *   Dialog  sm 400 · md 560 · lg 720, width min(size, 100vw − 32px),
 *           max-height min(85vh, 100dvh − 32px); header and footer stay put, only the body scrolls.
 *   Sheet   right side, min(640px, 100vw); full screen below 640 px; same structure.
 * Anything bigger than a short form or a paragraph is a page, not an overlay.
 *
 * Same API as Radix Dialog (Root/Trigger/Close/Content), but Radix and the overlay markup live in
 * ./dialog-impl.tsx and load when the trigger is hovered, focused or clicked, so pages with dialogs
 * don't pay for them in first-load JS (plan §6). Focus returns to the trigger on close.
 */

type Impl = ComponentType<OverlayImplProps>

type OverlayState = {
  open: boolean
  setOpen: (open: boolean) => void
  Impl: Impl | null
  preload: () => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const OverlayContext = createContext<OverlayState | null>(null)

let implLoader: Promise<Impl> | null = null
const loadImpl = () => (implLoader ??= import('./dialog-impl').then((m) => m.default))

function useOverlay(component: string) {
  const state = use(OverlayContext)
  if (!state) throw new Error(`<${component}> must be inside <Dialog> or <Sheet>`)
  return state
}

export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const [Impl, setImpl] = useState<Impl | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const open = controlledOpen ?? uncontrolledOpen

  const preload = useCallback(() => {
    void loadImpl().then((impl) => setImpl(() => impl))
  }, [])

  const setOpen = useCallback(
    (next: boolean) => {
      if (next) preload()
      onOpenChange?.(next)
      if (controlledOpen === undefined) setUncontrolledOpen(next)
    },
    [controlledOpen, onOpenChange, preload],
  )

  // Opened from outside (controlled) before the implementation arrived.
  if (open && !Impl) preload()

  return <OverlayContext value={{ open, setOpen, Impl, preload, triggerRef }}>{children}</OverlayContext>
}

/** A Sheet has the same state and API as a Dialog; only its content differs. */
export function Sheet(props: Parameters<typeof Dialog>[0]) {
  return <Dialog {...props} />
}

export function DialogTrigger({ children }: { asChild?: boolean; children: ReactNode }) {
  const { open, setOpen, preload, triggerRef } = useOverlay('DialogTrigger')
  return (
    <Slot.Root
      ref={triggerRef as React.Ref<HTMLElement>}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-state={open ? 'open' : 'closed'}
      onPointerEnter={preload}
      onFocus={preload}
      onClick={(e: React.MouseEvent) => {
        if (!e.defaultPrevented) setOpen(true)
      }}
    >
      {children}
    </Slot.Root>
  )
}

export function SheetTrigger(props: Parameters<typeof DialogTrigger>[0]) {
  return <DialogTrigger {...props} />
}

export function DialogClose({ children }: { asChild?: boolean; children: ReactNode }) {
  const { setOpen } = useOverlay('DialogClose')
  return (
    <Slot.Root
      onClick={(e: React.MouseEvent) => {
        if (!e.defaultPrevented) setOpen(false)
      }}
    >
      {children}
    </Slot.Root>
  )
}

function OverlayContent({ kind, ...props }: OverlayContentProps & { kind: 'dialog' | 'sheet'; size?: keyof typeof dialogWidths }) {
  const { open, setOpen, Impl, triggerRef } = useOverlay(kind === 'sheet' ? 'SheetContent' : 'DialogContent')
  const returnFocus = useCallback(
    (e: Event) => {
      e.preventDefault()
      triggerRef.current?.focus()
    },
    [triggerRef],
  )
  if (!Impl) return null
  return <Impl kind={kind} open={open} onOpenChange={setOpen} returnFocus={returnFocus} {...props} />
}

export function DialogContent(props: OverlayContentProps & { size?: keyof typeof dialogWidths }) {
  return <OverlayContent kind="dialog" {...props} />
}

export function SheetContent(props: OverlayContentProps) {
  return <OverlayContent kind="sheet" {...props} />
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
