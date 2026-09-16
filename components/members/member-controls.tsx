'use client'

import { UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createContext, use, useState, type FormEvent, type ReactNode } from 'react'

import { ActionButton } from '@/components/ui/action-button'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/client/toast'
import { useAction } from '@/lib/client/use-action'
import type { Result } from '@/lib/shared/result'

/*
 * The interactive parts of ./members-section.tsx (a server component): each button is its own
 * island. Outcomes are toasts, which decay and can be dismissed — an earlier version wrote a green
 * line above the list that was never cleared, so it sat there for the rest of the session.
 */

const DELAYED = 'Email delivery is delayed until tomorrow. They’ll get the invite then.'

const Refresh = createContext<(message: string) => void>(() => {})

export function MembersFeedback({ children }: { children: ReactNode }) {
  const router = useRouter()
  const refresh = (message: string) => {
    toast.success(message)
    router.refresh()
  }
  return <Refresh value={refresh}>{children}</Refresh>
}

/**
 * Handing the account to someone else. Irreversible from the current owner's side — only the new
 * owner can hand it back — so it states that plainly (ux-contract rule 7).
 */
export function TransferOwnerButton({
  userId,
  name,
  orgLabel,
  action,
}: {
  userId: string
  name: string
  /** "the team" or the company's name. */
  orgLabel: string
  action: (input: { userId: string }) => Promise<Result<{ name: string }>>
}) {
  const refresh = use(Refresh)
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-text-secondary">
          Make owner
        </Button>
      }
      title={`Make ${name} the owner?`}
      consequence={`${name} will be able to invite and remove people, and you won't. Only they can give it back.`}
      confirmLabel="Make owner"
      pendingLabel="Transferring…"
      onConfirm={() => action({ userId })}
      onConfirmed={(data) => refresh(`${data.name} now owns ${orgLabel}.`)}
    />
  )
}

export function LeaveButton({
  label,
  title,
  consequence,
  action,
}: {
  label: string
  title: string
  consequence: string
  action: (input: { confirm: 'leave' }) => Promise<Result<{ redirectTo: string }>>
}) {
  const router = useRouter()
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          {label}
        </Button>
      }
      title={title}
      consequence={consequence}
      confirmLabel={label}
      pendingLabel="Leaving…"
      tone="danger"
      onConfirm={() => action({ confirm: 'leave' })}
      onConfirmed={(data) => {
        router.push(data.redirectTo)
        router.refresh()
      }}
    />
  )
}

export function RemoveButton({
  userId,
  name,
  consequence,
  removedFrom,
  action,
}: {
  userId: string
  name: string
  consequence: string
  /** "the team" or the company's name: "Dana Lee was removed from {removedFrom}." */
  removedFrom: string
  action: (input: { userId: string }) => Promise<Result<{ name: string }>>
}) {
  const refresh = use(Refresh)
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-text-secondary">
          Remove
        </Button>
      }
      title={`Remove ${name}?`}
      consequence={consequence}
      confirmLabel="Remove"
      pendingLabel="Removing…"
      tone="danger"
      onConfirm={() => action({ userId })}
      onConfirmed={(data) => refresh(`${data.name} was removed from ${removedFrom}.`)}
    />
  )
}

type InviteResult = Promise<Result<{ email: string; emailDelayed: boolean }>>

export function InviteRowActions({
  inviteId,
  resend,
  revoke,
}: {
  inviteId: string
  /** Omitted when invites can't be sent right now (a company that isn't approved). */
  resend?: (input: { inviteId: string }) => InviteResult
  revoke: (input: { inviteId: string }) => Promise<Result<{ email: string }>>
}) {
  const refresh = use(Refresh)
  return (
    <div className="flex shrink-0 gap-1">
      {resend ? (
        <ActionButton
          variant="ghost"
          size="sm"
          action={() => resend({ inviteId })}
          pendingLabel="Sending…"
          successLabel="Sent"
          onSuccess={(data) => refresh(data.emailDelayed ? `New invite to ${data.email} saved. ${DELAYED}` : `A new invite link was sent to ${data.email}.`)}
        >
          Resend
        </ActionButton>
      ) : null}
      <ActionButton
        variant="ghost"
        size="sm"
        className="text-text-secondary"
        action={() => revoke({ inviteId })}
        pendingLabel="Revoking…"
        onSuccess={(data) => refresh(`The invite to ${data.email} was revoked. Its link no longer works.`)}
      >
        Revoke
      </ActionButton>
    </div>
  )
}

export function InviteButton({
  title,
  description,
  fieldLabel,
  placeholder,
  footnote,
  action,
}: {
  title: string
  description: string
  fieldLabel: string
  placeholder: string
  footnote?: string
  action: (input: { email: string }) => InviteResult
}) {
  const refresh = use(Refresh)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const { run, pending, fieldErrors, error, reset } = useAction(action, {
    errorToast: false,
    onSuccess: (data) => {
      setOpen(false)
      setEmail('')
      refresh(data.emailDelayed ? `Invite to ${data.email} saved. ${DELAYED}` : `Invite sent to ${data.email}.`)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ email })
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
        <Button variant="secondary" size="sm" data-qa-overlay={title}>
          <UserPlus aria-hidden="true" />
          Invite by email
        </Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        title={title}
        description={description}
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="invite-form" data-action-button="" loading={pending} loadingLabel="Sending…">
              Send invite
            </Button>
          </>
        }
      >
        <form id="invite-form" noValidate onSubmit={submit} className="grid gap-4">
          <Field label={fieldLabel} required error={fieldErrors.email}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder={placeholder} autoFocus />
          </Field>
          {error && !fieldErrors.email ? <Banner tone="danger" title={error.message} /> : null}
          {footnote ? <p className="text-small text-text-tertiary">{footnote}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
