'use server'

import { updateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'

import { requireSponsorMember, requireSponsorOwner, requireViewer } from '@/lib/server/authz'
import { TAGS } from '@/lib/server/cache-tags'
import {
  confirmDefaultQuestions,
  createCompany,
  CREATE_COMPANY_CONFLICTS,
  createCompanyUpload,
  finalizeCompanyLogo,
  leaveCompany,
  removeCompanyMember,
  submitCompanyForReview,
  transferCompanyOwnership,
  saveCompanyQuestions,
  updateCompanyProfile,
} from '@/lib/server/data/company'
import { createInvite, inviteOrgFor, resendInvite, revokeInvite } from '@/lib/server/data/invites'
import { scheduleDrain } from '@/lib/server/email/drain'
import { enqueueEmail, PRIORITY } from '@/lib/server/email/outbox'
import { absoluteUrl } from '@/lib/server/env'
import { notifyAdmins, notifySponsor, notifyUsers } from '@/lib/server/notify'
import { defineAction } from '@/lib/server/result'
import { subjectKey } from '@/lib/shared/notifications'
import { inTransaction } from '@/lib/server/transaction'
import { discard } from '@/lib/server/uploads'
import { formatDate } from '@/lib/shared/format'
import { companyProfileSchema, createCompanySchema, questionsSchema } from '@/lib/shared/schemas/company'
import { inviteSchema } from '@/lib/shared/schemas/team'
import { displayName, type Viewer } from '@/lib/shared/viewer'

/* Company first run, profile, questions, logo and members (prompt 3, scope A and B). */

const invalidateCompany = (sponsorId: string) => {
  updateTag(TAGS.sponsors)
  updateTag(TAGS.sponsor(sponsorId))
}

export const createCompanyAction = defineAction(
  createCompanySchema,
  async (input) => {
    const viewer = await requireViewer()
    // Nothing reaches the admin queue yet: a draft nobody submitted isn't work. submitCompany does
    // that once they've actually filled it in.
    await inTransaction(() => createCompany(viewer, input))
    // Straight to the profile and questions: that's what the review looks at, and the company is a
    // draft until it sends itself for review.
    return { redirectTo: '/welcome/company' }
  },
  { conflict: CREATE_COMPANY_CONFLICTS },
)

export const saveCompanyProfile = defineAction(companyProfileSchema, async (input) => {
  const viewer = await requireSponsorMember()
  const profile = await inTransaction(() => updateCompanyProfile(viewer, input))
  invalidateCompany(profile.id)
  return profile
})

export const saveQuestions = defineAction(questionsSchema, async ({ questions }) => {
  const viewer = await requireSponsorMember()
  const profile = await inTransaction(() => saveCompanyQuestions(viewer, questions))
  invalidateCompany(profile.id)
  return profile
})

export const keepDefaultQuestions = defineAction(z.object({}), async () => {
  const viewer = await requireSponsorMember()
  return inTransaction(() => confirmDefaultQuestions(viewer))
})

export const createCompanyUploadUrl = defineAction(z.object({ imageType: z.enum(['image/webp', 'image/jpeg']) }), async ({ imageType }) => {
  const viewer = await requireSponsorMember()
  return createCompanyUpload(viewer, imageType === 'image/jpeg' ? 'jpg' : 'webp')
})

export const saveCompanyLogo = defineAction(z.object({ path: z.string().min(1).max(300) }), async ({ path }) => {
  const viewer = await requireSponsorMember()
  const result = await inTransaction(() => finalizeCompanyLogo(viewer, path))
  after(() => discard('public', result.replaced))
  invalidateCompany(viewer.sponsor.id)
  return result.profile
})

// ─── Members and invites ────────────────────────────────────────────────────────────────

async function sendCompanyInvite(viewer: Viewer & { sponsor: NonNullable<Viewer['sponsor']> }, invite: { id: string; email: string; expiresAt: Date }, token: string) {
  return enqueueEmail({
    to: invite.email,
    template: 'sponsor-invite',
    data: {
      companyName: viewer.sponsor.name.slice(0, 200),
      inviterName: displayName(viewer).slice(0, 200),
      email: invite.email,
      acceptUrl: absoluteUrl(`/invite/${token}`),
      expiresOn: formatDate(invite.expiresAt, new Date(0)),
    },
    priority: PRIORITY.transactional,
    dedupeKey: `invite:${invite.id}:${invite.expiresAt.getTime()}`,
  })
}

export const inviteCompanyMember = defineAction(inviteSchema, async ({ email }) => {
  const viewer = await requireSponsorOwner()
  const result = await inTransaction(async () => {
    const { invite, token } = await createInvite(viewer, inviteOrgFor(viewer, 'sponsor'), email)
    const sent = await sendCompanyInvite(viewer, invite, token)
    return { id: invite.id, email: invite.email, expiresAt: invite.expiresAt, emailDelayed: sent.delayed }
  })
  await scheduleDrain()
  return result
})

export const resendCompanyInvite = defineAction(z.object({ inviteId: z.uuid() }), async ({ inviteId }) => {
  const viewer = await requireSponsorOwner()
  const result = await inTransaction(async () => {
    const { invite, token } = await resendInvite(viewer, inviteOrgFor(viewer, 'sponsor'), inviteId)
    const sent = await sendCompanyInvite(viewer, invite, token)
    return { id: invite.id, email: invite.email, expiresAt: invite.expiresAt, emailDelayed: sent.delayed }
  })
  await scheduleDrain()
  return result
})

export const revokeCompanyInvite = defineAction(z.object({ inviteId: z.uuid() }), async ({ inviteId }) => {
  const viewer = await requireSponsorOwner()
  return inTransaction(() => revokeInvite(viewer, inviteOrgFor(viewer, 'sponsor'), inviteId))
})

export const removeCompanyMemberAction = defineAction(z.object({ userId: z.uuid() }), async ({ userId }) => {
  const viewer = await requireSponsorOwner()
  return inTransaction(async () => {
    const removed = await removeCompanyMember(viewer, userId)
    await notifyUsers([userId], {
      type: 'sponsor.member_removed',
      title: `You were removed from ${viewer.sponsor.name}`,
      body: 'Ask someone at your company if you think this was a mistake.',
      href: '/welcome',
    })
    return removed
  })
})

export const submitCompany = defineAction(z.object({ confirm: z.literal('submit') }), async () => {
  const viewer = await requireSponsorMember()
  const company = await inTransaction(async () => {
    const row = await submitCompanyForReview(viewer)
    await notifyAdmins({
      type: 'admin.company_submitted',
      title: `${row.name} asked to join`,
      href: `/admin/companies/${row.id}`,
      subjectKey: subjectKey('sponsor', row.id),
    })
    return row
  })
  // No instant admin email: pending companies are in the daily digest.
  return { redirectTo: '/welcome/pending', name: company.name }
})

export const transferCompanyOwnershipAction = defineAction(z.object({ userId: z.uuid() }), async ({ userId }) => {
  const viewer = await requireSponsorOwner()
  return inTransaction(async () => {
    const r = await transferCompanyOwnership(viewer, userId)
    await notifyUsers([userId], {
      type: 'sponsor.ownership_transferred',
      title: `You now own ${viewer.sponsor.name}`,
      body: 'You can invite coworkers and remove people.',
      href: '/company#members',
    })
    return r
  })
})

export const leaveCompanyAction = defineAction(z.object({ confirm: z.literal('leave') }), async () => {
  const viewer = await requireSponsorMember()
  await inTransaction(async () => {
    await leaveCompany(viewer)
    await notifySponsor(viewer.sponsor.id, { type: 'sponsor.member_left', title: `${displayName(viewer)} left ${viewer.sponsor.name}`, href: '/company#members' })
  })
  return { redirectTo: '/welcome' }
})
