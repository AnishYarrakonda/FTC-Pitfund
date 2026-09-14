'use client'

import { Check, Mail, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { inviteTeamMember, resendTeamInvite, revokeTeamInvite } from '@/app/actions/invites'
import { leaveMyTeam, removeMember } from '@/app/actions/team'
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

type Member = { userId: string; name: string; email: string; avatarUrl: string | null; joinedAt: string }
type Invite = { id: string; email: string; expiresAt: string; createdAt: string; expired: boolean; invitedByName: string | null }

const DELAYED = 'Email delivery is delayed until tomorrow. They’ll get the invite then.'

export function MembersSection({ viewerId, members, invites }: { viewerId: string; members: Member[]; invites: Invite[] }) {
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const onlyMember = members.length <= 1
  const refresh = (message: string | null) => {
    setNotice(message)
    router.refresh()
  }

  return (
    <FormSection
      id="members"
      title="Members"
      description="Everyone here shares the team account equally: the profile, the deck and every pitch."
    >
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
                <span className="min-w-0 text-small text-text-tertiary user-text">{m.email}</span>
              </div>
              {you ? (
                onlyMember ? null : (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        Leave team
                      </Button>
                    }
                    title="Leave this team?"
                    consequence="You’ll lose access to the team’s profile and pitches. A coach on the team can invite you back."
                    confirmLabel="Leave team"
                    pendingLabel="Leaving…"
                    tone="danger"
                    onConfirm={() => leaveMyTeam({ confirm: 'leave' })}
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
                  consequence="They’ll lose access to the team’s profile and pitches right away. You can invite them again later."
                  confirmLabel="Remove"
                  pendingLabel="Removing…"
                  tone="danger"
                  onConfirm={() => removeMember({ userId: m.userId })}
                  onConfirmed={(data) => refresh(`${data.name} was removed from the team.`)}
                />
              )}
            </li>
          )
        })}
      </ul>

      {onlyMember ? (
        <p className="text-small text-text-tertiary">
          You’re the only member. To leave, invite another coach first, or email {SUPPORT_EMAIL} to delete the team.
        </p>
      ) : null}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-text">Invited</h3>
          <InviteDialog onInvited={(email, delayed) => refresh(delayed ? `Invite to ${email} saved. ${DELAYED}` : `Invite sent to ${email}.`)} />
        </div>
        {invites.length === 0 ? (
          <p className="text-body text-text-tertiary">No pending invites. Invite a co-coach so the team isn’t locked to one person.</p>
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
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    action={() => resendTeamInvite({ inviteId: invite.id })}
                    pendingLabel="Sending…"
                    successLabel="Sent"
                    onSuccess={(data) => refresh(data.emailDelayed ? `New invite to ${data.email} saved. ${DELAYED}` : `A new invite link was sent to ${data.email}.`)}
                  >
                    Resend
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className="text-text-secondary"
                    action={() => revokeTeamInvite({ inviteId: invite.id })}
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

function InviteDialog({ onInvited }: { onInvited: (email: string, delayed: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const { run, pending, fieldErrors, error, reset } = useAction(inviteTeamMember, {
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
        <Button variant="secondary" size="sm" data-qa-overlay="Invite a coach">
          <UserPlus aria-hidden="true" />
          Invite by email
        </Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        title="Invite a coach"
        description="They’ll get an email with a link. It works once, for that address, for 14 days."
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
          <Field label="Email address" required error={fieldErrors.email}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="coach@example.com" autoFocus />
          </Field>
          {error && !fieldErrors.email ? <Banner tone="danger" title={error.message} /> : null}
          <p className="text-small text-text-tertiary">Invite adult coaches and mentors only. Students don’t get accounts.</p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
