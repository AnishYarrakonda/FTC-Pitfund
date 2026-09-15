'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from '@/lib/client/toast'

import {
  approveCompanyAction,
  deleteCompanyAction,
  deleteTeamAction,
  recheckTeamAction,
  rejectCompanyAction,
  suspendCompanyAction,
  suspendTeamAction,
  unsuspendCompanyAction,
  unsuspendTeamAction,
  unverifyTeamAction,
  verifyTeamAction,
} from '@/app/actions/admin'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import type { Result } from '@/lib/shared/result'
import type { SponsorStatus } from '@/lib/shared/types'

/* Admin decisions on a company or team page (prompt 3, scope D). */

const delayed = (emailDelayed: boolean, n: number) => (emailDelayed ? 'email delayed until tomorrow' : `${n === 1 ? '1 person' : `${n} people`} emailed`)

export function CompanyDecisions({ sponsorId, name, status }: { sponsorId: string; name: string; status: SponsorStatus }) {
  const router = useRouter()
  const done = (message: string) => {
    toast.success(message)
    router.refresh()
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'pending' || status === 'rejected' ? (
        <ActionButton action={() => approveCompanyAction({ sponsorId })} pendingLabel="Approving…" onSuccess={(d) => done(`${d.name} is approved · ${delayed(d.emailDelayed, d.notified)}`)}>
          Approve
        </ActionButton>
      ) : null}
      {status === 'pending' ? <RejectCompanyDialog sponsorId={sponsorId} name={name} onDone={done} /> : null}
      {status === 'approved' || status === 'pending' ? (
        <ConfirmDialog
          trigger={
            <Button variant="secondary" className="text-danger">
              Suspend
            </Button>
          }
          title={`Suspend ${name}?`}
          consequence="Teams can’t see or pitch it, and its members are blocked until you unsuspend it."
          confirmLabel="Suspend company"
          pendingLabel="Suspending…"
          tone="danger"
          onConfirm={() => suspendCompanyAction({ sponsorId })}
          onConfirmed={(d) => done(`${d.name} is suspended.`)}
        />
      ) : null}
      {status === 'suspended' ? (
        <ConfirmDialog
          trigger={<Button variant="secondary">Unsuspend</Button>}
          title={`Unsuspend ${name}?`}
          consequence="It becomes approved again: teams can find and pitch it, and its members can sign in to it."
          confirmLabel="Unsuspend"
          pendingLabel="Unsuspending…"
          onConfirm={() => unsuspendCompanyAction({ sponsorId })}
          onConfirmed={(d) => done(`${d.name} is active again.`)}
        />
      ) : null}
    </div>
  )
}

function RejectCompanyDialog({ sponsorId, name, onDone }: { sponsorId: string; name: string; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const { run, pending, error, fieldErrors, reset } = useAction(rejectCompanyAction, {
    errorToast: false,
    onSuccess: (d) => {
      setOpen(false)
      setNote('')
      onDone(`${d.name} wasn’t approved · ${delayed(d.emailDelayed, d.notified)}`)
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ sponsorId, note })
  }
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
        <Button variant="secondary">Reject</Button>
      </DialogTrigger>
      <DialogContent
        size="md"
        title={`Reject ${name}?`}
        description="Its members are emailed your note and the support address. The company stays hidden from teams."
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="reject-company-form" variant="danger" data-action-button="" loading={pending} loadingLabel="Rejecting…">
              Reject company
            </Button>
          </>
        }
      >
        <form id="reject-company-form" noValidate onSubmit={submit} className="grid gap-4">
          <Field label="Note for the company" required error={fieldErrors.note}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} minRows={4} maxRows={10} autoFocus placeholder="We couldn’t confirm that this company sponsors student programs…" />
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

export function TeamDecisions({ teamId, number, verified, suspended }: { teamId: string; number: number; verified: boolean; suspended: boolean }) {
  const router = useRouter()
  // Verify is optimistic with Undo (plan: reversible actions don't confirm).
  const [optimisticVerified, setOptimisticVerified] = useState<boolean | null>(null)
  const shownVerified = optimisticVerified ?? verified

  const verify = async () => {
    setOptimisticVerified(true)
    const result = await verifyTeamAction({ teamId }).catch(() => null)
    if (!result?.ok) {
      setOptimisticVerified(null)
      toast.error(result?.ok === false ? result.error.message : 'Couldn’t reach FTC Pitfund. Check your connection.')
      return
    }
    router.refresh()
    toast.success(`Team ${number} is verified.`, {
      action: {
        label: 'Undo',
        onClick: () => {
          setOptimisticVerified(false)
          void unverifyTeamAction({ teamId }).then((r) => {
            if (!r.ok) toast.error(r.error.message)
            router.refresh()
          })
        },
      },
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {shownVerified ? (
        <ActionButton
          variant="secondary"
          action={() => unverifyTeamAction({ teamId })}
          pendingLabel="Removing…"
          onSuccess={() => {
            setOptimisticVerified(false)
            toast.success(`Team ${number} is no longer verified.`)
            router.refresh()
          }}
        >
          Unverify
        </ActionButton>
      ) : (
        <Button data-action-button="" onClick={() => void verify()} disabled={suspended}>
          Verify team
        </Button>
      )}
      {suspended ? (
        <ConfirmDialog
          trigger={<Button variant="secondary">Unsuspend</Button>}
          title={`Unsuspend Team ${number}?`}
          consequence="Its public page comes back and its coaches can pitch again. Withdrawn pitches stay withdrawn."
          confirmLabel="Unsuspend team"
          pendingLabel="Unsuspending…"
          onConfirm={() => unsuspendTeamAction({ teamId })}
          onConfirmed={() => {
            toast.success(`Team ${number} is active again.`)
            router.refresh()
          }}
        />
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="secondary" className="text-danger">
              Suspend
            </Button>
          }
          title={`Suspend Team ${number}?`}
          consequence="Its public page disappears, its coaches can’t pitch, and pitches waiting for review are withdrawn with a notice to the coaches."
          confirmLabel="Suspend team"
          pendingLabel="Suspending…"
          tone="danger"
          onConfirm={() => suspendTeamAction({ teamId })}
          onConfirmed={(d) => {
            toast.success(`Team ${d.number} is suspended${d.withdrawn ? ` · ${d.withdrawn === 1 ? '1 pitch' : `${d.withdrawn} pitches`} withdrawn` : ''}.`)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

export function RecheckRecordButton({ teamId }: { teamId: string }) {
  const router = useRouter()
  return (
    <ActionButton
      size="sm"
      variant="secondary"
      action={() => recheckTeamAction({ teamId })}
      pendingLabel="Checking FIRST records…"
      onSuccess={(d) => {
        if (d.outcome === 'unavailable') toast.warning('FIRST records aren’t reachable right now. Try again later.')
        else toast.success(d.outcome === 'matched' ? `Found in FIRST records: ${d.record?.name ?? ''}` : 'Not found in FIRST records.')
        router.refresh()
      }}
    >
      Re-check FIRST records
    </ActionButton>
  )
}

/** Delete a team or company: type its name to confirm (plan: irreversible, cascades storage cleanup). */
export function DeleteOrgDialog({ kind, id, name, consequence }: { kind: 'team' | 'company'; id: string; name: string; consequence: ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase()
  const action = (input: { confirmName: string }): Promise<Result<{ redirectTo: string }>> =>
    kind === 'team' ? deleteTeamAction({ teamId: id, confirmName: input.confirmName }) : deleteCompanyAction({ sponsorId: id, confirmName: input.confirmName })
  const { run, pending, error, fieldErrors, reset } = useAction(action, {
    errorToast: false,
    onSuccess: (d) => {
      setOpen(false)
      toast.success(`${name} was deleted.`)
      router.push(d.redirectTo)
      router.refresh()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (matches) void run({ confirmName: typed })
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        if (!next) {
          reset()
          setTyped('')
        }
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-danger">
          Delete {kind}
        </Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        title={`Delete ${name}?`}
        description={consequence}
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form={`delete-${kind}-form`} variant="danger" data-action-button="" loading={pending} loadingLabel="Deleting…" disabled={!matches && !pending}>
              Delete forever
            </Button>
          </>
        }
      >
        <form id={`delete-${kind}-form`} noValidate onSubmit={submit} className="grid gap-4">
          <Field label={<>Type <span className="font-semibold user-text">{name}</span> to confirm</>} error={fieldErrors.confirmName}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </Field>
          {error && !fieldErrors.confirmName ? (
            <p role="alert" className="text-body text-danger">
              {error.message}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
