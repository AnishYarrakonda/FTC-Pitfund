'use server'


import { requireTeamMember } from '@/lib/server/authz'
import { deleteDraft, pitchEmailKey, saveDraft, startPitch, submitPitch, SUBMIT_CONFLICTS, withdrawPitch } from '@/lib/server/data/pitches'
import { simulated } from '@/lib/server/dev'
import { scheduleDrain } from '@/lib/server/email/drain'
import { enqueueEmail, PRIORITY } from '@/lib/server/email/outbox'
import { absoluteUrl } from '@/lib/server/env'
import { notifyAdmins, notifySponsor, notifyTeam } from '@/lib/server/notify'
import { AppError, defineAction } from '@/lib/server/result'
import { inTransaction } from '@/lib/server/transaction'
import { formatAsk } from '@/lib/shared/pitch'
import { pitchIdSchema, saveDraftSchema, sponsorIdSchema, submitPitchSchema } from '@/lib/shared/schemas/pitch'
import { displayName } from '@/lib/shared/viewer'

/* The pitch composer and pitch tracking (prompt 2, scope E and F). */

const BUSY = 'FTC Pitfund is busy right now. Try again in a moment.'

export const startPitchAction = defineAction(sponsorIdSchema, async ({ sponsorId }) => {
  const viewer = await requireTeamMember()
  const { pitchId } = await inTransaction(() => startPitch(viewer, sponsorId))
  return { pitchId, redirectTo: `/sponsors/${sponsorId}/pitch` }
})

export const saveDraftAction = defineAction(saveDraftSchema, async (input) => {
  const viewer = await requireTeamMember()
  if (await simulated('save-draft')) throw new AppError('UNAVAILABLE', BUSY)
  return inTransaction(() => saveDraft(viewer, input))
})

export const submitPitchAction = defineAction(
  submitPitchSchema,
  async (input) => {
    const viewer = await requireTeamMember()
    if (await simulated('submit-pitch')) throw new AppError('UNAVAILABLE', BUSY)
    const result = await inTransaction(async () => {
      const r = await submitPitch(viewer, input)
      const team = viewer.team
      const title = `Team ${team.number} pitched ${r.company.name}`
      const href = `/admin/pitches/${r.pitch.id}`
      await notifyAdmins({ type: 'pitch.submitted', title: r.resubmission ? `${title} again` : title, body: 'Waiting for review.', href })
      await notifyTeam(
        team.id,
        { type: 'pitch.submitted', title: `${displayName(viewer)} submitted the pitch to ${r.company.name}`, body: 'A reviewer will read it, usually within a day.', href: `/pitches/${r.pitch.id}` },
        { exceptUserId: viewer.id },
      )
      const ask = formatAsk({ type: r.pitch.askType, amountCents: r.pitch.askAmountCents, note: r.pitch.askNote })
      for (const admin of r.admins) {
        await enqueueEmail({
          to: admin.email,
          template: 'admin-new-pitch',
          data: {
            teamNumber: team.number,
            teamName: team.name,
            verified: team.status === 'approved',
            companyName: r.company.name,
            summary: r.team?.summary?.slice(0, 400) ?? null,
            ask: ask ? [ask, r.pitch.askNote].filter(Boolean).join(': ').slice(0, 700) : null,
            resubmission: r.resubmission,
            reviewUrl: absoluteUrl(href),
          },
          priority: PRIORITY.adminInstant,
          dedupeKey: pitchEmailKey(r.pitch.id, 'admin-new-pitch', admin.id, r.pitch.submittedAt?.getTime()),
        })
      }
      return { pitchId: r.pitch.id }
    })
    await scheduleDrain()
    return { pitchId: result.pitchId, redirectTo: `/pitches/${result.pitchId}` }
  },
  { conflict: SUBMIT_CONFLICTS },
)

export const withdrawPitchAction = defineAction(pitchIdSchema, async ({ pitchId }) => {
  const viewer = await requireTeamMember()
  const result = await inTransaction(async () => {
    const r = await withdrawPitch(viewer, pitchId)
    let emailDelayed = false
    if (r.wasSent) {
      await notifySponsor(r.sponsorId, {
        type: 'pitch.withdrawn',
        title: `Team ${viewer.team.number} · ${viewer.team.name} withdrew its pitch`,
        body: 'You don’t need to respond.',
        href: `/inbox/${r.pitchId}`,
      })
      for (const member of r.members) {
        const sent = await enqueueEmail({
          to: member.email,
          template: 'pitch-withdrawn',
          data: { teamNumber: viewer.team.number, teamName: viewer.team.name, companyName: r.companyName, inboxUrl: absoluteUrl(`/inbox/${r.pitchId}`) },
          priority: PRIORITY.transactional,
          dedupeKey: pitchEmailKey(r.pitchId, 'pitch-withdrawn', member.id),
        })
        emailDelayed ||= sent.delayed
      }
    }
    await notifyTeam(
      viewer.team.id,
      { type: 'pitch.withdrawn', title: `${displayName(viewer)} withdrew the pitch to ${r.companyName}`, href: `/pitches/${r.pitchId}` },
      { exceptUserId: viewer.id },
    )
    return { ...r, emailDelayed }
  })
  await scheduleDrain()
  return { pitchId: result.pitchId, companyName: result.companyName, companyNotified: result.wasSent, emailDelayed: result.emailDelayed }
})

export const deleteDraftAction = defineAction(pitchIdSchema, async ({ pitchId }) => {
  const viewer = await requireTeamMember()
  const row = await inTransaction(() => deleteDraft(viewer, pitchId))
  return { redirectTo: `/sponsors/${row.sponsorId}` }
})
