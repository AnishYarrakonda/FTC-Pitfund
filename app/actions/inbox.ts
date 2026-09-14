'use server'

import { requireApprovedSponsor } from '@/lib/server/authz'
import { respondInterested, respondNotAFit } from '@/lib/server/data/inbox'
import { pitchEmailKey } from '@/lib/server/data/pitches'
import { scheduleDrain } from '@/lib/server/email/drain'
import { enqueueEmail, PRIORITY } from '@/lib/server/email/outbox'
import { absoluteUrl } from '@/lib/server/env'
import { notifySponsor, notifyTeam } from '@/lib/server/notify'
import { defineAction } from '@/lib/server/result'
import { inTransaction } from '@/lib/server/transaction'
import { declineReasonText, type DeclineReasonKey } from '@/lib/shared/company'
import { declineSchema } from '@/lib/shared/schemas/company'
import { pitchIdSchema } from '@/lib/shared/schemas/pitch'
import { displayName } from '@/lib/shared/viewer'

/* A company's answer to a pitch (prompt 3, scope C; plan §3.2 "Sponsor response"). */

export const respondInterestedAction = defineAction(pitchIdSchema, async ({ pitchId }) => {
  const viewer = await requireApprovedSponsor()
  const result = await inTransaction(async () => {
    const r = await respondInterested(viewer, pitchId)
    const teamLabel = `Team ${r.team.number} · ${r.team.name}`
    await notifyTeam(r.team.id, {
      type: 'pitch.matched',
      title: `${r.company.name} is interested`,
      body: `You’re connected with ${r.sponsorContact.name}. Their contact details are on the pitch.`,
      href: `/pitches/${pitchId}`,
    })
    await notifySponsor(
      viewer.sponsor.id,
      { type: 'pitch.matched', title: `${displayName(viewer)} connected with ${teamLabel}`, body: `${r.teamContact.name} will hear from you.`, href: `/inbox/${pitchId}` },
      { exceptUserId: viewer.id },
    )
    let emailDelayed = false
    if (r.coach?.email) {
      const sent = await enqueueEmail({
        to: r.coach.email,
        template: 'match-team',
        data: {
          teamNumber: r.team.number,
          companyName: r.company.name.slice(0, 200),
          contactName: r.sponsorContact.name.slice(0, 200),
          contactTitle: r.sponsorContact.jobTitle ?? null,
          contactEmail: r.sponsorContact.email,
          contactPhone: r.sponsorContact.phone,
          companyWebsite: r.sponsorContact.website ?? null,
          pitchUrl: absoluteUrl(`/pitches/${pitchId}`),
        },
        priority: PRIORITY.transactional,
        dedupeKey: pitchEmailKey(pitchId, 'match-team', r.coach.id),
      })
      emailDelayed ||= sent.delayed
    }
    if (r.teamContact.email) {
      const sent = await enqueueEmail({
        to: viewer.email,
        template: 'match-sponsor',
        data: {
          teamNumber: r.team.number,
          teamName: r.team.name.slice(0, 200),
          contactName: r.teamContact.name.slice(0, 200),
          contactEmail: r.teamContact.email,
          contactPhone: r.teamContact.phone,
          teamUrl: r.teamContact.teamUrl ?? absoluteUrl(`/t/${r.team.number}`),
          pitchUrl: absoluteUrl(`/inbox/${pitchId}`),
        },
        priority: PRIORITY.transactional,
        dedupeKey: pitchEmailKey(pitchId, 'match-sponsor', viewer.id),
      })
      emailDelayed ||= sent.delayed
    }
    return { teamLabel, emailDelayed }
  })
  await scheduleDrain()
  return result
})

export const respondNotAFitAction = defineAction(declineSchema, async ({ pitchId, reason, note }) => {
  const viewer = await requireApprovedSponsor()
  const text = declineReasonText(reason as DeclineReasonKey | null, note)
  const result = await inTransaction(async () => {
    const r = await respondNotAFit(viewer, pitchId, text)
    const teamLabel = `Team ${r.team.number} · ${r.team.name}`
    await notifyTeam(r.team.id, { type: 'pitch.declined', title: `${r.companyName} isn’t a fit this time`, body: text, href: `/pitches/${pitchId}` })
    await notifySponsor(viewer.sponsor.id, { type: 'pitch.declined', title: `${displayName(viewer)} marked ${teamLabel} not a fit`, href: `/inbox/${pitchId}` }, { exceptUserId: viewer.id })
    let emailDelayed = false
    if (r.coach?.email) {
      const sent = await enqueueEmail({
        to: r.coach.email,
        template: 'pitch-not-a-fit',
        data: { teamNumber: r.team.number, companyName: r.companyName.slice(0, 200), reason: text, pitchUrl: absoluteUrl(`/pitches/${pitchId}`) },
        priority: PRIORITY.transactional,
        dedupeKey: pitchEmailKey(pitchId, 'pitch-not-a-fit', r.coach.id),
      })
      emailDelayed = sent.delayed
    }
    return { teamLabel, emailDelayed }
  })
  await scheduleDrain()
  return result
})
