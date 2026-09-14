'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { approvePitchAction, rejectPitchAction, sendBackPitchAction } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Banner, KeyboardHint } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import { cn } from '@/lib/shared/cn'
import type { ActionError } from '@/lib/shared/result'

type Props = {
  pitchId: string
  teamNumber: number
  companyName: string
  /** Why Approve & send is blocked (company not approved, team suspended), if it is. */
  blocker: string | null
  previousId: string | null
  nextId: string | null
}

const DELAYED = 'email delayed until tomorrow'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]'))
}

/**
 * Approve & send · Send back · Reject on the full-page review (plan §3.2 "Admin review"). No extra
 * confirm for approval (the page is the deliberate context, plan §3.1 #7); Send back and Reject
 * open their note dialogs. Keyboard: A / S / R, J / K for the next and previous pitch. After a
 * decision a toast says who was told, and the page advances to the next pitch in the queue.
 */
export function ReviewDecisions({ pitchId, teamNumber, companyName, blocker, previousId, nextId }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<'send-back' | 'reject' | null>(null)
  const [conflict, setConflict] = useState<ActionError | null>(null)
  const approveRef = useRef<HTMLButtonElement>(null)

  const advance = (next: string | null) => {
    if (next) {
      router.push(`/admin/pitches/${next}`)
    } else {
      toast.success('You’re all caught up.', { id: 'caught-up' })
      router.push('/admin')
    }
    router.refresh()
  }
  const onError = (e: ActionError) => {
    if (e.code === 'CONFLICT' || e.code === 'NOT_FOUND') setConflict(e)
  }

  const approve = useAction(approvePitchAction, {
    errorToast: false,
    onError,
    onSuccess: (data) => {
      const people = data.notified === 1 ? '1 person' : `${data.notified} people`
      toast.success(data.emailDelayed ? `Sent to ${data.companyName} · ${DELAYED}` : `Sent to ${data.companyName} · ${people} notified`)
      advance(data.nextId)
    },
  })

  const busy = approve.pending || dialog !== null
  const canApprove = !blocker && !conflict

  const latest = useRef({ approve: approve.run, canApprove, previousId, nextId, busy })
  useEffect(() => {
    latest.current = { approve: approve.run, canApprove, previousId, nextId, busy }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const state = latest.current
      const key = e.key.toLowerCase()
      if (key === 'j' && state.nextId) {
        e.preventDefault()
        router.push(`/admin/pitches/${state.nextId}`)
      } else if (key === 'k' && state.previousId) {
        e.preventDefault()
        router.push(`/admin/pitches/${state.previousId}`)
      } else if (state.busy) {
        return
      } else if (key === 'a' && state.canApprove) {
        e.preventDefault()
        approveRef.current?.focus()
        void state.approve({ pitchId })
      } else if (key === 's') {
        e.preventDefault()
        setDialog('send-back')
      } else if (key === 'r') {
        e.preventDefault()
        setDialog('reject')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pitchId, router])

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur',
        'lg:static lg:z-auto lg:rounded-dialog lg:border lg:bg-surface lg:p-5 lg:backdrop-blur-none',
      )}
    >
      <div className="mx-auto grid max-w-review gap-3">
        <p className="hidden text-lead font-semibold tracking-tight text-text lg:block">Decision</p>

        {conflict ? (
          <Banner
            tone="warning"
            title={conflict.message}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setConflict(null)
                  router.refresh()
                }}
              >
                <RefreshCw aria-hidden="true" />
                Refresh
              </Button>
            }
          />
        ) : null}
        {approve.error && !conflict ? (
          <p role="alert" className="text-small text-danger">
            {approve.error.message}
          </p>
        ) : null}
        {blocker ? <p className="text-small text-warning">{blocker}</p> : null}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Button
            ref={approveRef}
            data-action-button=""
            loading={approve.pending}
            loadingLabel="Sending…"
            disabled={!canApprove || dialog !== null}
            aria-describedby={blocker ? undefined : 'approve-hint'}
            onClick={() => void approve.run({ pitchId })}
            className="col-span-2 lg:col-span-1 lg:justify-between"
          >
            <span>Approve &amp; send</span>
            <KeyboardHint keys={['A']} className="hidden lg:inline-flex [&_kbd]:border-white/40 [&_kbd]:bg-white/10 [&_kbd]:text-white [&_kbd]:shadow-none" />
          </Button>
          <NoteDialog
            open={dialog === 'send-back'}
            onOpenChange={(open) => setDialog(open ? 'send-back' : null)}
            kind="send-back"
            pitchId={pitchId}
            teamNumber={teamNumber}
            onDone={advance}
            onConflict={setConflict}
            trigger={
              <Button variant="secondary" disabled={approve.pending || Boolean(conflict)} className="lg:justify-between">
                <span>Send back</span>
                <KeyboardHint keys={['S']} className="hidden lg:inline-flex" />
              </Button>
            }
          />
          <NoteDialog
            open={dialog === 'reject'}
            onOpenChange={(open) => setDialog(open ? 'reject' : null)}
            kind="reject"
            pitchId={pitchId}
            teamNumber={teamNumber}
            onDone={advance}
            onConflict={setConflict}
            trigger={
              <Button variant="secondary" disabled={approve.pending || Boolean(conflict)} className="text-danger lg:justify-between">
                <span>Reject</span>
                <KeyboardHint keys={['R']} className="hidden lg:inline-flex" />
              </Button>
            }
          />
        </div>
        <p id="approve-hint" className="hidden text-small text-text-tertiary lg:block">
          Approving sends it to {companyName} and emails everyone there.
        </p>
        <p className="hidden items-center gap-2 border-t border-border pt-3 text-small text-text-tertiary lg:flex">
          <KeyboardHint keys={['J']} /> next <KeyboardHint keys={['K']} className="ml-2" /> previous
        </p>
      </div>
    </div>
  )
}

function NoteDialog({
  open,
  onOpenChange,
  kind,
  pitchId,
  teamNumber,
  onDone,
  onConflict,
  trigger,
}: {
  trigger: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: 'send-back' | 'reject'
  pitchId: string
  teamNumber: number
  onDone: (nextId: string | null) => void
  onConflict: (e: ActionError) => void
}) {
  const [note, setNote] = useState('')
  const sendBack = kind === 'send-back'
  const { run, pending, error, fieldErrors, reset } = useAction(
    (input: { note: string }) => (sendBack ? sendBackPitchAction({ pitchId, note: input.note }) : rejectPitchAction({ pitchId, note: input.note })),
    {
      errorToast: false,
      onSuccess: (data) => {
        onOpenChange(false)
        setNote('')
        const told = data.emailDelayed ? `Team ${teamNumber} will see it in FTC Pitfund · ${DELAYED}` : `Team ${teamNumber} was told`
        toast.success(sendBack ? `Sent back · ${told}` : `Rejected · ${told}`)
        onDone(data.nextId)
      },
      onError: (e) => {
        if (e.code === 'CONFLICT' || e.code === 'NOT_FOUND') {
          onOpenChange(false)
          onConflict(e)
        }
      },
    },
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ note })
  }
  const formId = `${kind}-form`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        size="md"
        title={sendBack ? `Send back to Team ${teamNumber}` : `Reject Team ${teamNumber}’s pitch`}
        description={
          sendBack
            ? 'The team sees your note, edits the pitch and resubmits it. Say exactly what to change.'
            : 'The pitch won’t be sent and the team can’t resubmit it. A note is optional; if you write one, the team sees it.'
        }
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form={formId} variant={sendBack ? 'primary' : 'danger'} data-action-button="" loading={pending} loadingLabel={sendBack ? 'Sending back…' : 'Rejecting…'}>
              {sendBack ? 'Send back' : 'Reject pitch'}
            </Button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={submit} className="grid gap-4">
          <Field label={sendBack ? 'Note for the team' : 'Note for the team (optional)'} required={sendBack} error={fieldErrors.note}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              minRows={4}
              maxRows={12}
              autoFocus
              placeholder={sendBack ? 'Say what the funding would pay for in the second answer…' : 'This pitch doesn’t answer the company’s questions…'}
            />
          </Field>
          {error && !fieldErrors.note ? (
            <p role="alert" className="text-body text-danger">
              {error.message}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
