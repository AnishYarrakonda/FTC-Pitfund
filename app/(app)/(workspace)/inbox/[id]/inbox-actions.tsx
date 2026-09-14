'use client'

import { Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { respondInterestedAction, respondNotAFitAction } from '@/app/actions/inbox'
import { Button } from '@/components/ui/button'
import { RadioCards } from '@/components/ui/choice'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import { DECLINE_REASONS, MAX_DECLINE_NOTE, type DeclineReasonKey } from '@/lib/shared/company'

const delayedCopy = (team: string) => `Email delivery is delayed until tomorrow. ${team} will still see it in FTC Pitfund.`

/**
 * The sticky Interested / Not a fit bar on a new pitch (plan §3.2 "Sponsor response"). Both are
 * outward-facing, so both confirm. A conflict (the team withdrew, a coworker answered first)
 * shows its message in the dialog and refreshes the page behind it.
 */
export function InboxActions({ pitchId, teamLabel }: { pitchId: string; teamLabel: string }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-10 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-text-secondary">Interested? You’ll both get each other’s contact details.</p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <NotAFitDialog pitchId={pitchId} teamLabel={teamLabel} />
          <InterestedDialog pitchId={pitchId} teamLabel={teamLabel} />
        </div>
      </div>
    </div>
  )
}

function InterestedDialog({ pitchId, teamLabel }: { pitchId: string; teamLabel: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { run, pending, error, reset } = useAction(respondInterestedAction, {
    errorToast: false,
    onSuccess: (data) => {
      setOpen(false)
      if (data.emailDelayed) toast.warning(delayedCopy(teamLabel))
      router.refresh()
    },
    onError: (e) => {
      if (e.code === 'CONFLICT' || e.code === 'NOT_FOUND') router.refresh()
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
      <DialogTrigger asChild>
        <Button>
          <Check aria-hidden="true" />
          Interested
        </Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        title={`Connect with ${teamLabel}?`}
        description={`We’ll share your name, title and email with ${teamLabel}, and theirs with you. You’ll take it from here.`}
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button data-action-button="" loading={pending} loadingLabel="Connecting…" onClick={() => void run({ pitchId })}>
              Share contact details
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="text-body text-danger">
            {error.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function NotAFitDialog({ pitchId, teamLabel }: { pitchId: string; teamLabel: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<DeclineReasonKey | null>(null)
  const [note, setNote] = useState('')
  const { run, pending, error, fieldErrors, reset } = useAction(respondNotAFitAction, {
    errorToast: false,
    onSuccess: (data) => {
      setOpen(false)
      toast.success(`Marked not a fit. ${teamLabel} has been notified.`, { description: data.emailDelayed ? delayedCopy(teamLabel) : undefined })
      router.push('/inbox')
      router.refresh()
    },
    onError: (e) => {
      if (e.code === 'CONFLICT' || e.code === 'NOT_FOUND') router.refresh()
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ pitchId, reason, note: reason === 'other' ? note : null })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        if (!next) {
          reset()
          setReason(null)
          setNote('')
        }
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary">
          <X aria-hidden="true" />
          Not a fit
        </Button>
      </DialogTrigger>
      <DialogContent
        size="md"
        title="Mark this pitch not a fit?"
        description={`${teamLabel} will be told. A reason is optional; if you give one, they’ll see it.`}
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="not-a-fit-form" variant="danger" data-action-button="" loading={pending} loadingLabel="Saving…">
              Mark not a fit
            </Button>
          </>
        }
      >
        <form id="not-a-fit-form" noValidate onSubmit={submit} className="grid gap-4">
          <fieldset className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <legend className="text-small font-medium text-text">Reason</legend>
              {reason ? (
                <button type="button" onClick={() => setReason(null)} className="text-small font-medium text-text-secondary hover:text-text">
                  Clear
                </button>
              ) : (
                <span className="text-caption text-text-tertiary">Optional</span>
              )}
            </div>
            <RadioCards<DeclineReasonKey>
              label="Reason"
              // An empty value is a controlled "nothing chosen" (the reason is optional).
              value={(reason ?? '') as DeclineReasonKey}
              onValueChange={setReason}
              options={DECLINE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
            />
          </fieldset>
          {reason === 'other' ? (
            <Field label="Tell the team why" required error={fieldErrors.note}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_DECLINE_NOTE} minRows={3} maxRows={8} autoFocus />
            </Field>
          ) : null}
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
