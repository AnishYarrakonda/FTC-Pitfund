'use client'

import { Check, Mail, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { inviteCompanyMember, leaveCompanyAction, removeCompanyMemberAction, resendCompanyInvite, revokeCompanyInvite } from '@/app/actions/company'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Banner } from '@/components/ui/feedback'
import { Field, FormSection } from '@/components/ui/field'
import { Avatar } from '@/components/ui/identity'
import { Input } from '@/components/ui/input'
import { useAction } from '@/lib/client/use-action'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { formatDate } from '@/lib/shared/format'
import type { SponsorStatus } from '@/lib/shared/types'

export type CompanyMember = { userId: string; name: string; email: string; jobTitle: string | null; avatarUrl: string | null; joinedAt: string }
export type CompanyInvite = { id: string; email: string; expiresAt: string; createdAt: string; expired: boolean }

const DELAYED = 'Email delivery is delayed until tomorrow. They’ll get the invite then.'

/** Company members and invites (prompt 3, scope B). Invites need an approved company. */
export function CompanyMembers({
  viewerId,
  companyName,
  status,
  members,
  invites,
}: {
  viewerId: string
  companyName: string
  status: SponsorStatus
  members: CompanyMember[]
  invites: CompanyInvite[]
}) {
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const onlyMember = members.length <= 1
  const canInvite = status === 'approved'
  const refresh = (message: string | null) => {
    setNotice(message)
    router.refresh()
  }

  return (
    <FormSection id="members" title="Members" description={`Everyone here shares ${companyName}’s account equally and gets the email when a pitch arrives.`}>
      {notice ? (
        <p role="status" className="flex items-start gap-2 text-body text-success">
          <Check aria-hidden="true" className="mt-[3px] size-4 shrink-0" />
          <span className="min-w-0 user-text">{notice}</span>
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-menu border border-border bg-surface">
        {members.map((m) => {
          const you = m.userId === viewerId
          const label = m.name.trim() || m.email
          return (
            <li key={m.userId} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Avatar name={label} src={m.avatarUrl} size="md" />
              <div className="grid min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2 text-body font-medium text-text">
                  <span className="min-w-0 user-text">{label}</span>
                  {you ? <span className="shrink-0 rounded-control bg-muted px-1.5 text-caption font-medium text-text-secondary">You</span> : null}
                </span>
                <span className="min-w-0 text-small text-text-tertiary line-clamp-2 user-text">{[m.jobTitle, m.email].filter(Boolean).join(' · ')}</span>
              </div>
              {you ? (
                onlyMember ? null : (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        Leave company
                      </Button>
                    }
                    title={`Leave ${companyName}?`}
                    consequence="You’ll lose access to its pitches and profile. A coworker can invite you back."
                    confirmLabel="Leave company"
                    pendingLabel="Leaving…"
                    tone="danger"
                    onConfirm={() => leaveCompanyAction({ confirm: 'leave' })}
                    onConfirmed={(data) => {
                      router.push(data.redirectTo)
                      router.refresh()
                    }}
                  />
                )
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm" className="text-text-secondary">
                      Remove
                    </Button>
                  }
                  title={`Remove ${label}?`}
                  consequence="They’ll lose access to the company’s pitches and profile right away. You can invite them again later."
                  confirmLabel="Remove"
                  pendingLabel="Removing…"
                  tone="danger"
                  onConfirm={() => removeCompanyMemberAction({ userId: m.userId })}
                  onConfirmed={(data) => refresh(`${data.name} was removed from ${companyName}.`)}
                />
              )}
            </li>
          )
        })}
      </ul>

      {onlyMember ? (
        <p className="text-small text-text-tertiary">
          You’re the only member. To leave, invite a coworker first, or email {SUPPORT_EMAIL} to close the company.
        </p>
      ) : null}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-text">Invited</h3>
          {canInvite ? (
            <InviteDialog companyName={companyName} onInvited={(email, delayed) => refresh(delayed ? `Invite to ${email} saved. ${DELAYED}` : `Invite sent to ${email}.`)} />
          ) : (
            <Button variant="secondary" size="sm" disabled aria-describedby="invite-disabled-reason">
              <UserPlus aria-hidden="true" />
              Invite by email
            </Button>
          )}
        </div>
        {!canInvite ? (
          <p id="invite-disabled-reason" className="text-small text-text-tertiary">
            {status === 'pending' ? `You can invite coworkers once ${companyName} is approved.` : `${companyName} can’t invite coworkers right now.`}
          </p>
        ) : null}
        {invites.length === 0 ? (
          canInvite ? <p className="text-body text-text-tertiary">No pending invites. Invite a coworker so pitches never wait on one person.</p> : null
        ) : (
          <ul className="divide-y divide-border rounded-menu border border-border bg-surface">
            {invites.map((invite) => (
              <li key={invite.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-text-tertiary">
                  <Mail aria-hidden="true" className="size-4" />
                </span>
                <div className="grid min-w-0 flex-1">
                  <span className="min-w-0 text-body font-medium text-text user-text">{invite.email}</span>
                  <span className={invite.expired ? 'text-small text-warning' : 'text-small text-text-tertiary'}>
                    {invite.expired ? `Expired ${formatDate(invite.expiresAt)}` : `Invited ${formatDate(invite.createdAt)} · Expires ${formatDate(invite.expiresAt)}`}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canInvite ? (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      action={() => resendCompanyInvite({ inviteId: invite.id })}
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
                    action={() => revokeCompanyInvite({ inviteId: invite.id })}
                    pendingLabel="Revoking…"
                    onSuccess={(data) => refresh(`The invite to ${data.email} was revoked. Its link no longer works.`)}
                  >
                    Revoke
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormSection>
  )
}

function InviteDialog({ companyName, onInvited }: { companyName: string; onInvited: (email: string, delayed: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const { run, pending, fieldErrors, error, reset } = useAction(inviteCompanyMember, {
    errorToast: false,
    onSuccess: (data) => {
      setOpen(false)
      setEmail('')
      onInvited(data.email, data.emailDelayed)
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
        <Button variant="secondary" size="sm" data-qa-overlay="Invite a coworker">
          <UserPlus aria-hidden="true" />
          Invite by email
        </Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        title="Invite a coworker"
        description={`They’ll get an email with a link to join ${companyName}. It works once, for that address, for 14 days.`}
        dismissible={!pending}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="company-invite-form" data-action-button="" loading={pending} loadingLabel="Sending…">
              Send invite
            </Button>
          </>
        }
      >
        <form id="company-invite-form" noValidate onSubmit={submit} className="grid gap-4">
          <Field label="Work email" required error={fieldErrors.email}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="name@company.com" autoFocus />
          </Field>
          {error && !fieldErrors.email ? <Banner tone="danger" title={error.message} /> : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
