'use server'

import { z } from 'zod'

import { requireTeamMember, requireViewer } from '@/lib/server/authz'
import { acceptInvite, ACCEPT_INVITE_CONFLICTS, createInvite, inviteOrgFor, resendInvite, revokeInvite } from '@/lib/server/data/invites'
import { scheduleDrain } from '@/lib/server/email/drain'
import { enqueueEmail, PRIORITY } from '@/lib/server/email/outbox'
import { absoluteUrl } from '@/lib/server/env'
import { notifySponsor, notifyTeam } from '@/lib/server/notify'
import { defineAction } from '@/lib/server/result'
import { inTransaction } from '@/lib/server/transaction'
import { formatDate } from '@/lib/shared/format'
import { inviteSchema } from '@/lib/shared/schemas/team'
import { displayName, type Viewer } from '@/lib/shared/viewer'

/*
 * Team invites (prompt 2). Accepting is generic over team and company invites; prompt 3 adds the
 * company-side create/resend/revoke actions and the `sponsor-invite` template on the same data layer.
 */

async function sendTeamInvite(viewer: Viewer & { team: NonNullable<Viewer['team']> }, invite: { id: string; email: string; expiresAt: Date }, token: string) {
  return enqueueEmail({
    to: invite.email,
    template: 'team-invite',
    data: {
      teamNumber: viewer.team.number,
      teamName: viewer.team.name,
      inviterName: displayName(viewer),
      email: invite.email,
      acceptUrl: absoluteUrl(`/invite/${token}`),
      expiresOn: formatDate(invite.expiresAt, new Date(0)),
    },
    priority: PRIORITY.transactional,
    dedupeKey: `invite:${invite.id}:${invite.expiresAt.getTime()}`,
  })
}

export const inviteTeamMember = defineAction(inviteSchema, async ({ email }) => {
  const viewer = await requireTeamMember()
  const result = await inTransaction(async () => {
    const { invite, token } = await createInvite(viewer, inviteOrgFor(viewer, 'team'), email)
    const sent = await sendTeamInvite(viewer, invite, token)
    return { id: invite.id, email: invite.email, expiresAt: invite.expiresAt, emailDelayed: sent.delayed }
  })
  await scheduleDrain()
  return result
})

export const resendTeamInvite = defineAction(z.object({ inviteId: z.uuid() }), async ({ inviteId }) => {
  const viewer = await requireTeamMember()
  const result = await inTransaction(async () => {
    const { invite, token } = await resendInvite(viewer, inviteOrgFor(viewer, 'team'), inviteId)
    const sent = await sendTeamInvite(viewer, invite, token)
    return { id: invite.id, email: invite.email, expiresAt: invite.expiresAt, emailDelayed: sent.delayed }
  })
  await scheduleDrain()
  return result
})

export const revokeTeamInvite = defineAction(z.object({ inviteId: z.uuid() }), async ({ inviteId }) => {
  const viewer = await requireTeamMember()
  return inTransaction(() => revokeInvite(viewer, inviteOrgFor(viewer, 'team'), inviteId))
})

export const acceptInviteAction = defineAction(
  z.object({ token: z.string().min(1).max(200), acceptsTerms: z.boolean() }),
  async ({ token, acceptsTerms }) => {
    const viewer = await requireViewer()
    return inTransaction(async () => {
      const accepted = await acceptInvite(viewer, token, { acceptsTerms })
      const n = { type: 'org.member_joined', title: `${displayName(viewer)} accepted an invite and joined`, body: viewer.email }
      if (accepted.kind === 'team') await notifyTeam(accepted.orgId, { ...n, href: '/team#members' }, { exceptUserId: viewer.id })
      else await notifySponsor(accepted.orgId, { ...n, href: '/company#members' }, { exceptUserId: viewer.id })
      return { redirectTo: accepted.home }
    })
  },
  { conflict: ACCEPT_INVITE_CONFLICTS },
)
