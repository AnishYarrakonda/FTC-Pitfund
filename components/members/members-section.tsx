import { Mail, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { FormSection } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { formatDate } from '@/lib/shared/format'
import type { Result } from '@/lib/shared/result'

import { InviteButton, InviteRowActions, LeaveButton, MembersFeedback, RemoveButton } from './member-controls'

export type SectionMember = { userId: string; name: string; email: string; jobTitle?: string | null; avatarUrl: string | null }
export type SectionInvite = { id: string; email: string; expiresAt: string; createdAt: string; expired: boolean }

type InviteResult = Promise<Result<{ email: string; emailDelayed: boolean }>>

/**
 * Members and pending invites of a team or company, shared by /team and /company. Rendered on the
 * server; only the buttons (./member-controls.tsx) ship JavaScript. Every member is equal, so any
 * member can invite, resend, revoke and remove; the last member can't leave.
 */
export function MembersSection({
  viewerId,
  description,
  members,
  invites,
  copy,
  actions,
  inviteDisabledReason,
}: {
  viewerId: string
  description: string
  members: SectionMember[]
  invites: SectionInvite[]
  copy: {
    leaveLabel: string
    leaveTitle: string
    leaveConsequence: string
    removeConsequence: string
    removedFrom: string
    onlyMember: ReactNode
    noInvites: string
    inviteTitle: string
    inviteDescription: string
    inviteFieldLabel: string
    invitePlaceholder: string
    inviteFootnote?: string
  }
  actions: {
    leave: (input: { confirm: 'leave' }) => Promise<Result<{ redirectTo: string }>>
    remove: (input: { userId: string }) => Promise<Result<{ name: string }>>
    invite: (input: { email: string }) => InviteResult
    resend: (input: { inviteId: string }) => InviteResult
    revoke: (input: { inviteId: string }) => Promise<Result<{ email: string }>>
  }
  /** Set when invites can't be sent right now; the button is disabled with this reason. */
  inviteDisabledReason?: string | null
}) {
  const onlyMember = members.length <= 1
  const canInvite = !inviteDisabledReason

  return (
    <FormSection id="members" title="Members" description={description}>
      <MembersFeedback>
        <ul className="divide-y divide-border rounded-menu border border-border bg-surface">
          {members.map((m) => {
            const you = m.userId === viewerId
            const label = m.name.trim() || m.email
            return (
              <li key={m.userId} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <Avatar name={label} src={m.avatarUrl} size="md" />
                <div className="grid min-w-0 flex-1 basis-48">
                  <span className="flex min-w-0 items-center gap-2 text-body font-medium text-text">
                    <span className="min-w-0 user-text">{label}</span>
                    {you ? <span className="shrink-0 rounded-control bg-muted px-1.5 text-caption font-medium text-text-secondary">You</span> : null}
                  </span>
                  <span className="min-w-0 text-small text-text-tertiary line-clamp-2 user-text">{[m.jobTitle, m.email].filter(Boolean).join(' · ')}</span>
                </div>
                {you ? (
                  onlyMember ? null : <LeaveButton label={copy.leaveLabel} title={copy.leaveTitle} consequence={copy.leaveConsequence} action={actions.leave} />
                ) : (
                  <RemoveButton userId={m.userId} name={label} consequence={copy.removeConsequence} removedFrom={copy.removedFrom} action={actions.remove} />
                )}
              </li>
            )
          })}
        </ul>

        {onlyMember ? <p className="text-small text-text-tertiary">{copy.onlyMember}</p> : null}

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-body font-semibold text-text">Invited</h3>
            {canInvite ? (
              <InviteButton
                title={copy.inviteTitle}
                description={copy.inviteDescription}
                fieldLabel={copy.inviteFieldLabel}
                placeholder={copy.invitePlaceholder}
                footnote={copy.inviteFootnote}
                action={actions.invite}
              />
            ) : (
              // A plain button: Button adds a click handler, which a server component can't render.
              <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} disabled aria-describedby="invite-disabled-reason">
                <UserPlus aria-hidden="true" />
                Invite by email
              </button>
            )}
          </div>
          {!canInvite ? (
            <p id="invite-disabled-reason" className="text-small text-text-tertiary">
              {inviteDisabledReason}
            </p>
          ) : null}
          {invites.length === 0 ? (
            canInvite ? <p className="text-body text-text-tertiary">{copy.noInvites}</p> : null
          ) : (
            <ul className="divide-y divide-border rounded-menu border border-border bg-surface">
              {invites.map((invite) => (
                <li key={invite.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-text-tertiary">
                    <Mail aria-hidden="true" className="size-4" />
                  </span>
                  <div className="grid min-w-0 flex-1 basis-48">
                    <span className="min-w-0 text-body font-medium text-text user-text">{invite.email}</span>
                    <span className={invite.expired ? 'text-small text-warning' : 'text-small text-text-tertiary'}>
                      {invite.expired ? `Expired ${formatDate(invite.expiresAt)}` : `Invited ${formatDate(invite.createdAt)} · Expires ${formatDate(invite.expiresAt)}`}
                    </span>
                  </div>
                  <InviteRowActions inviteId={invite.id} resend={canInvite ? actions.resend : undefined} revoke={actions.revoke} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </MembersFeedback>
    </FormSection>
  )
}
