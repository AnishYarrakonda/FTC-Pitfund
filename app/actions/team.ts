'use server'

import { updateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'

import { audit } from '@/lib/server/audit'
import { requireTeamMember, requireTeamOwner, requireViewer } from '@/lib/server/authz'
import { TAGS } from '@/lib/server/cache-tags'
import {
  checkStagedDeck,
  createTeam,
  CREATE_TEAM_CONFLICTS,
  createTeamUpload,
  decideJoinRequest,
  DECIDE_JOIN_CONFLICTS,
  finalizeDeck,
  finalizeTeamLogo,
  JOIN_REQUEST_CONFLICTS,
  finalizeTeamProof,
  leaveTeam,
  lookupTeamNumber,
  removeTeamMember,
  requestToJoinTeam,
  submitTeamForReview,
  SUBMIT_TEAM_CONFLICTS,
  transferTeamOwnership,
  updateTeamProfile,
} from '@/lib/server/data/teams'
import { simulated } from '@/lib/server/dev'
import { scheduleDrain } from '@/lib/server/email/drain'
import { enqueueEmail, PRIORITY } from '@/lib/server/email/outbox'
import { absoluteUrl } from '@/lib/server/env'
import { notifyAdmins, notifyTeam, notifyUsers } from '@/lib/server/notify'
import { defineAction } from '@/lib/server/result'
import { inTransaction } from '@/lib/server/transaction'
import { discard } from '@/lib/server/uploads'
import { createTeamSchema, lookupTeamSchema, teamProfileSchema } from '@/lib/shared/schemas/team'
import { subjectKey } from '@/lib/shared/notifications'
import { teamLabel } from '@/lib/shared/team'
import { displayName } from '@/lib/shared/viewer'

/* Team first run, profile, files, members and join requests (prompt 2, scope A and B). */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const lookupTeam = defineAction(lookupTeamSchema, async ({ number }) => {
  await requireViewer()
  if (await simulated('ftc-timeout')) {
    await sleep(4200)
    return { status: 'unavailable' as const, reason: 'Simulated timeout' }
  }
  if (await simulated('ftc-not-found')) return { status: 'not_found' as const }
  const result = await lookupTeamNumber(number)
  // Outage details are for logs, not for the browser.
  return result.status === 'unavailable' ? { status: 'unavailable' as const, reason: '' } : result
})

export const createTeamAction = defineAction(
  createTeamSchema,
  async (input) => {
    const viewer = await requireViewer()
    const team = await inTransaction(() => createTeam(viewer, input))
    updateTag(TAGS.teamNumber(team.number))
    // A new team is a draft: it finishes its setup page and sends itself for review before it can pitch.
    return { teamId: team.id, redirectTo: '/welcome/team' }
  },
  { conflict: CREATE_TEAM_CONFLICTS },
)

export const requestToJoin = defineAction(
  z.object({ teamId: z.uuid() }),
  async ({ teamId }) => {
    const viewer = await requireViewer()
    const result = await inTransaction(async () => {
      const r = await requestToJoinTeam(viewer, teamId)
      const who = displayName(viewer)
      await notifyTeam(r.team.id, { type: 'team.join_request', title: `${who} wants to join ${r.team.name}`, body: viewer.email, href: '/team#requests' })
      let delayed = false
      for (const member of r.members) {
        const sent = await enqueueEmail({
          to: member.email,
          template: 'join-request',
          data: { requesterName: viewer.name, requesterEmail: viewer.email, teamNumber: r.team.number, teamName: r.team.name, reviewUrl: absoluteUrl('/team#requests') },
          priority: PRIORITY.transactional,
          dedupeKey: `join-request:${r.requestId}:${member.userId}`,
        })
        delayed ||= sent.delayed
      }
      return { requestId: r.requestId, team: r.team, emailDelayed: delayed }
    })
    await scheduleDrain()
    return { requestId: result.requestId, teamLabel: teamLabel(result.team), emailDelayed: result.emailDelayed }
  },
  { conflict: JOIN_REQUEST_CONFLICTS },
)

export const saveTeamProfile = defineAction(teamProfileSchema, async (input) => {
  const viewer = await requireTeamMember()
  const profile = await inTransaction(() => updateTeamProfile(viewer, input))
  updateTag(TAGS.team(profile.id))
  return profile
})

// ─── Files ──────────────────────────────────────────────────────────────────────────────

export const createUploadUrl = defineAction(
  z.object({ purpose: z.enum(['deck', 'thumb', 'logo', 'proof']), imageType: z.enum(['image/webp', 'image/jpeg', 'image/png']).optional() }),
  async ({ purpose, imageType }) => {
    const viewer = await requireTeamMember()
    const ext = imageType === 'image/jpeg' ? 'jpg' : imageType === 'image/png' ? 'png' : 'webp'
    return createTeamUpload(viewer, purpose, ext)
  },
)

export const checkDeck = defineAction(z.object({ path: z.string().min(1).max(300) }), async ({ path }) => {
  const viewer = await requireTeamMember()
  return checkStagedDeck(viewer, path)
})

export const saveDeck = defineAction(
  z.object({ receipt: z.string().min(1).max(2000), thumbPath: z.string().min(1).max(300), consent: z.boolean() }),
  async (input) => {
    const viewer = await requireTeamMember()
    const result = await inTransaction(() => finalizeDeck(viewer, input))
    after(() => discard('public', result.replaced))
    updateTag(TAGS.team(viewer.team.id))
    return result.profile
  },
)

export const saveLogo = defineAction(z.object({ path: z.string().min(1).max(300) }), async ({ path }) => {
  const viewer = await requireTeamMember()
  const result = await inTransaction(() => finalizeTeamLogo(viewer, path))
  after(() => discard('public', result.replaced))
  updateTag(TAGS.team(viewer.team.id))
  return result.profile
})

/** The screenshot showing this person is on the team's roster. Goes to the private bucket. */
export const saveProof = defineAction(z.object({ path: z.string().min(1).max(300) }), async ({ path }) => {
  const viewer = await requireTeamMember()
  const result = await inTransaction(() => finalizeTeamProof(viewer, path))
  after(() => discard('verification', result.replaced))
  return result.profile
})

// ─── Review ─────────────────────────────────────────────────────────────────────────────

export const submitTeam = defineAction(
  z.object({ confirm: z.literal('submit') }),
  async () => {
    const viewer = await requireTeamMember()
    const result = await inTransaction(async () => {
      const team = await submitTeamForReview(viewer)
      await notifyAdmins({
        type: 'admin.team_submitted',
        title: `Team ${team.number} asked to join`,
        body: team.name,
        href: `/admin/teams/${team.id}`,
        subjectKey: subjectKey('team', team.id),
      })
      return team
    })
    // No instant admin email: submitted teams go out in the daily digest, like pending companies.
    return { redirectTo: '/welcome/pending', teamNumber: result.number }
  },
  { conflict: SUBMIT_TEAM_CONFLICTS },
)

export const transferOwnership = defineAction(z.object({ userId: z.uuid() }), async ({ userId }) => {
  const viewer = await requireTeamOwner()
  const result = await inTransaction(async () => {
    const r = await transferTeamOwnership(viewer, userId)
    await notifyUsers([userId], {
      type: 'team.ownership_transferred',
      title: `You now own ${teamLabel(viewer.team)}`,
      body: 'You can invite coaches, approve requests to join and remove people.',
      href: '/team#members',
    })
    return r
  })
  return result
})

// ─── Members ────────────────────────────────────────────────────────────────────────────

export const removeMember = defineAction(z.object({ userId: z.uuid() }), async ({ userId }) => {
  const viewer = await requireTeamOwner()
  const removed = await inTransaction(async () => {
    const r = await removeTeamMember(viewer, userId)
    await notifyUsers([userId], {
      type: 'team.member_removed',
      title: `You were removed from ${teamLabel(viewer.team)}`,
      body: 'Ask a coach on the team if you think this was a mistake.',
      href: '/welcome',
    })
    return r
  })
  return removed
})

export const leaveMyTeam = defineAction(z.object({ confirm: z.literal('leave') }), async () => {
  const viewer = await requireTeamMember()
  await inTransaction(async () => {
    await leaveTeam(viewer)
    await notifyTeam(viewer.team.id, { type: 'team.member_left', title: `${displayName(viewer)} left ${viewer.team.name}`, href: '/team#members' })
  })
  return { redirectTo: '/welcome' }
})

export const decideJoin = defineAction(
  z.object({ requestId: z.uuid(), decision: z.enum(['approve', 'decline']) }),
  async ({ requestId, decision }) => {
    const viewer = await requireTeamOwner()
    const result = await inTransaction(async () => {
      const r = await decideJoinRequest(viewer, requestId, decision)
      const approved = decision === 'approve'
      await notifyUsers([r.userId], {
        type: approved ? 'team.join_approved' : 'team.join_declined',
        title: approved ? `You joined ${teamLabel(viewer.team)}` : `Your request to join ${teamLabel(viewer.team)} wasn’t approved`,
        href: approved ? '/pitches' : '/welcome',
      })
      if (approved) {
        await notifyTeam(viewer.team.id, { type: 'team.member_joined', title: `${r.name} joined ${viewer.team.name}`, href: '/team#members' }, { exceptUserId: viewer.id })
      }
      const sent = r.email
        ? await enqueueEmail({
            to: r.email,
            template: 'join-decision',
            data: { approved, teamNumber: viewer.team.number, teamName: viewer.team.name, url: absoluteUrl(approved ? '/pitches' : '/welcome') },
            priority: PRIORITY.transactional,
            dedupeKey: `join-decision:${r.id}`,
          })
        : null
      if (approved) {
        await audit({ actorId: viewer.id, action: 'team.member_added', entityType: 'team', entityId: viewer.team.id, data: { userId: r.userId, via: 'join_request' } })
      }
      return { name: r.name, approved, emailDelayed: Boolean(sent?.delayed) }
    })
    await scheduleDrain()
    return result
  },
  { conflict: DECIDE_JOIN_CONFLICTS },
)
