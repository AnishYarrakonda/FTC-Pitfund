'use server'

import { updateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/lib/server/authz'
import { TAGS } from '@/lib/server/cache-tags'
import {
  approveCompany,
  deleteCompany,
  deleteTeam,
  recheckTeamRecord,
  rejectCompany,
  removeFromOrg,
  resolveReport,
  setAdmin,
  setUserSuspended,
  suspendCompany,
  suspendTeam,
  unsuspendCompany,
  unsuspendTeam,
  approveTeam,
  rejectTeam,
} from '@/lib/server/data/admin-orgs'
import { approvePitch, nextInQueue, rejectPitch, sendBackPitch } from '@/lib/server/data/admin-review'
import { pitchEmailKey } from '@/lib/server/data/pitches'
import { dismissEmail, makeEmailDue, requeueEmail } from '@/lib/server/data/system'
import { scheduleDrain } from '@/lib/server/email/drain'
import { enqueueEmail, PRIORITY, sendNow } from '@/lib/server/email/outbox'
import { absoluteUrl } from '@/lib/server/env'
import { notifyAdmins, notifySponsor, notifyTeam, notifyUsers, resolveNotifications } from '@/lib/server/notify'
import { AppError, defineAction } from '@/lib/server/result'
import { inTransaction } from '@/lib/server/transaction'
import { discard } from '@/lib/server/uploads'
import { formatAsk } from '@/lib/shared/pitch'
import { rejectPitchSchema, reviewNoteSchema, sponsorDecisionSchema } from '@/lib/shared/schemas/company'
import { pitchIdSchema } from '@/lib/shared/schemas/pitch'
import { subjectKey } from '@/lib/shared/notifications'
import { placeLabel } from '@/lib/shared/team'

/* The admin console's decisions (prompt 3, scope D). Every one is audited in its data function. */

const teamIdSchema = z.object({ teamId: z.uuid() })
const teamDecisionSchema = z.object({
  teamId: z.uuid(),
  note: z.string().trim().min(1, 'Write a note the team will see').max(2000, 'Keep the note under 2,000 characters'),
})
const sponsorIdSchema = z.object({ sponsorId: z.uuid() })
const userIdSchema = z.object({ userId: z.uuid() })

const invalidateTeam = (team: { id: string; number: number }) => {
  updateTag(TAGS.team(team.id))
  updateTag(TAGS.teamNumber(team.number))
}

const invalidateCompany = (sponsorId: string) => {
  updateTag(TAGS.sponsors)
  updateTag(TAGS.sponsor(sponsorId))
}

// ─── Pitch review ───────────────────────────────────────────────────────────────────────

export const approvePitchAction = defineAction(pitchIdSchema, async ({ pitchId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await approvePitch(admin, pitchId)
    const teamLabel = `Team ${r.team.number} · ${r.team.name}`
    await notifyTeam(r.team.id, { type: 'pitch.approved', title: `Your pitch to ${r.company.name} was sent`, body: 'A reviewer approved it. The company can read it now.', href: `/pitches/${pitchId}` })
    await notifySponsor(r.company.id, { type: 'pitch.received', title: `New pitch from ${teamLabel}`, body: 'A reviewer already read it.', href: `/inbox/${pitchId}` })

    let emailDelayed = false
    if (r.coach) {
      const sent = await enqueueEmail({
        to: r.coach.email,
        template: 'pitch-approved-coach',
        data: { teamNumber: r.team.number, companyName: r.company.name.slice(0, 200), pitchUrl: absoluteUrl(`/pitches/${pitchId}`) },
        priority: PRIORITY.transactional,
        dedupeKey: pitchEmailKey(pitchId, 'pitch-approved-coach', r.coach.id),
      })
      emailDelayed ||= sent.delayed
    }
    const ask = formatAsk({ type: r.pitch.askType, amountCents: r.pitch.askAmountCents, note: r.pitch.askNote })
    for (const member of r.members) {
      const sent = await enqueueEmail({
        to: member.email,
        template: 'new-pitch-sponsor',
        data: {
          teamNumber: r.team.number,
          teamName: r.team.name.slice(0, 200),
          place: placeLabel(r.team).slice(0, 200) || null,
          verified: r.team.status === 'approved',
          companyName: r.company.name.slice(0, 200),
          summary: r.team.summary?.slice(0, 400) ?? null,
          ask: ask ? [ask, r.pitch.askNote].filter(Boolean).join(': ').slice(0, 700) : null,
          inboxUrl: absoluteUrl(`/inbox/${pitchId}`),
        },
        priority: PRIORITY.transactional,
        dedupeKey: pitchEmailKey(pitchId, 'new-pitch-sponsor', member.id),
      })
      emailDelayed ||= sent.delayed
    }
    return { companyName: r.company.name, notified: r.members.length, emailDelayed }
  })
  await scheduleDrain()
  return { ...result, nextId: await nextInQueue(pitchId) }
})

export const sendBackPitchAction = defineAction(reviewNoteSchema, async ({ pitchId, note }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await sendBackPitch(admin, pitchId, note)
    await notifyTeam(r.team.id, { type: 'pitch.sent_back', title: `Changes requested on your pitch to ${r.company.name}`, body: note.slice(0, 300), href: `/pitches/${pitchId}` })
    const sent = r.coach
      ? await enqueueEmail({
          to: r.coach.email,
          template: 'pitch-sent-back',
          data: { teamNumber: r.team.number, companyName: r.company.name.slice(0, 200), note, editUrl: absoluteUrl(`/sponsors/${r.company.id}/pitch`) },
          priority: PRIORITY.transactional,
          dedupeKey: pitchEmailKey(pitchId, 'pitch-sent-back', r.coach.id, r.pitch.reviewedAt?.getTime()),
        })
      : null
    return { teamLabel: `Team ${r.team.number}`, emailDelayed: Boolean(sent?.delayed) }
  })
  await scheduleDrain()
  return { ...result, nextId: await nextInQueue(pitchId) }
})

export const rejectPitchAction = defineAction(rejectPitchSchema, async ({ pitchId, note }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await rejectPitch(admin, pitchId, note)
    await notifyTeam(r.team.id, { type: 'pitch.rejected', title: `Your pitch to ${r.company.name} wasn’t approved`, body: note?.slice(0, 300) ?? null, href: `/pitches/${pitchId}` })
    const sent = r.coach
      ? await enqueueEmail({
          to: r.coach.email,
          template: 'pitch-rejected',
          data: { teamNumber: r.team.number, companyName: r.company.name.slice(0, 200), note, pitchUrl: absoluteUrl(`/pitches/${pitchId}`) },
          priority: PRIORITY.transactional,
          dedupeKey: pitchEmailKey(pitchId, 'pitch-rejected', r.coach.id),
        })
      : null
    return { teamLabel: `Team ${r.team.number}`, emailDelayed: Boolean(sent?.delayed) }
  })
  await scheduleDrain()
  return { ...result, nextId: await nextInQueue(pitchId) }
})

// ─── Companies ──────────────────────────────────────────────────────────────────────────

export const approveCompanyAction = defineAction(sponsorIdSchema, async ({ sponsorId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await approveCompany(admin, sponsorId)
    await notifySponsor(sponsorId, { type: 'sponsor.approved', title: `${r.company.name} is approved`, body: 'Teams can now find and pitch your company.', href: '/inbox' })
    let emailDelayed = false
    for (const member of r.members) {
      const sent = await enqueueEmail({
        to: member.email,
        template: 'sponsor-approved',
        data: { companyName: r.company.name.slice(0, 200), companyUrl: absoluteUrl('/company') },
        priority: PRIORITY.transactional,
        dedupeKey: `sponsor:${sponsorId}:sponsor-approved:${member.id}:${Date.now()}`,
      })
      emailDelayed ||= sent.delayed
    }
    return { name: r.company.name, notified: r.members.length, emailDelayed }
  })
  invalidateCompany(sponsorId)
  await scheduleDrain()
  return result
})

export const rejectCompanyAction = defineAction(sponsorDecisionSchema, async ({ sponsorId, note }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await rejectCompany(admin, sponsorId, note)
    await notifySponsor(sponsorId, { type: 'sponsor.rejected', title: `${r.company.name} wasn’t approved`, body: note.slice(0, 300), href: '/inbox' })
    let emailDelayed = false
    for (const member of r.members) {
      const sent = await enqueueEmail({
        to: member.email,
        template: 'sponsor-rejected',
        data: { companyName: r.company.name.slice(0, 200), note, inboxUrl: absoluteUrl('/inbox') },
        priority: PRIORITY.transactional,
        dedupeKey: `sponsor:${sponsorId}:sponsor-rejected:${member.id}:${Date.now()}`,
      })
      emailDelayed ||= sent.delayed
    }
    return { name: r.company.name, notified: r.members.length, emailDelayed }
  })
  invalidateCompany(sponsorId)
  await scheduleDrain()
  return result
})

export const suspendCompanyAction = defineAction(sponsorIdSchema, async ({ sponsorId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await suspendCompany(admin, sponsorId)
    await notifySponsor(sponsorId, { type: 'sponsor.suspended', title: `${r.company.name} is suspended`, body: 'Teams can’t see or pitch your company.', href: '/inbox' })
    return { name: r.company.name }
  })
  invalidateCompany(sponsorId)
  return result
})

export const unsuspendCompanyAction = defineAction(sponsorIdSchema, async ({ sponsorId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await unsuspendCompany(admin, sponsorId)
    await notifySponsor(sponsorId, { type: 'sponsor.unsuspended', title: `${r.company.name} is active again`, body: 'Teams can find and pitch your company again.', href: '/inbox' })
    return { name: r.company.name }
  })
  invalidateCompany(sponsorId)
  return result
})

export const deleteCompanyAction = defineAction(z.object({ sponsorId: z.uuid(), confirmName: z.string().max(200) }), async ({ sponsorId, confirmName }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(() => deleteCompany(admin, sponsorId, confirmName))
  after(() => discard('public', result.objects))
  invalidateCompany(sponsorId)
  return { name: result.company.name, redirectTo: '/admin/directory?tab=companies' }
})

// ─── Teams ──────────────────────────────────────────────────────────────────────────────

export const approveTeamAction = defineAction(teamIdSchema, async ({ teamId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await approveTeam(admin, teamId)
    await notifyTeam(teamId, {
      type: 'team.approved',
      title: `Team ${r.team.number} is approved`,
      body: 'You can now pitch companies on FTC Pitfund.',
      href: '/pitches',
    })
    // The admin queue item is done, for every admin who was shown it.
    await resolveNotifications(subjectKey('team', teamId))
    let emailDelayed = false
    for (const member of r.members) {
      const sent = await enqueueEmail({
        to: member.email,
        template: 'team-approved',
        data: { teamNumber: r.team.number, teamName: r.team.name.slice(0, 200), pitchesUrl: absoluteUrl('/pitches') },
        priority: PRIORITY.transactional,
        dedupeKey: `team:${teamId}:team-approved:${member.id}:${Date.now()}`,
      })
      emailDelayed ||= sent.delayed
    }
    return { team: r.team, notified: r.members.length, emailDelayed }
  })
  invalidateTeam(result.team)
  await scheduleDrain()
  return { number: result.team.number, notified: result.notified, emailDelayed: result.emailDelayed }
})

export const rejectTeamAction = defineAction(teamDecisionSchema, async ({ teamId, note }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await rejectTeam(admin, teamId, note)
    await notifyTeam(teamId, {
      type: 'team.rejected',
      title: `Team ${r.team.number} wasn’t approved`,
      body: note.slice(0, 300),
      href: '/welcome/pending',
      subjectKey: subjectKey('team', teamId),
    })
    await resolveNotifications(subjectKey('team', teamId))
    let emailDelayed = false
    for (const member of r.members) {
      const sent = await enqueueEmail({
        to: member.email,
        template: 'team-rejected',
        data: { teamNumber: r.team.number, teamName: r.team.name.slice(0, 200), note, setupUrl: absoluteUrl('/welcome/team') },
        priority: PRIORITY.transactional,
        dedupeKey: `team:${teamId}:team-rejected:${member.id}:${Date.now()}`,
      })
      emailDelayed ||= sent.delayed
    }
    return { team: r.team, notified: r.members.length, emailDelayed }
  })
  invalidateTeam(result.team)
  await scheduleDrain()
  return { number: result.team.number, notified: result.notified, emailDelayed: result.emailDelayed }
})

export const suspendTeamAction = defineAction(teamIdSchema, async ({ teamId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await suspendTeam(admin, teamId)
    const withdrawn = r.withdrawn.length
    await notifyTeam(teamId, {
      type: 'team.suspended',
      title: `Team ${r.team.number} is suspended`,
      body: withdrawn ? `Its public page is hidden and ${withdrawn === 1 ? 'the pitch waiting for review was' : `${withdrawn} pitches waiting for review were`} withdrawn.` : 'Its public page is hidden and it can’t pitch.',
      href: '/pitches',
    })
    return r
  })
  invalidateTeam(result.team)
  return { number: result.team.number, withdrawn: result.withdrawn.length }
})

export const unsuspendTeamAction = defineAction(teamIdSchema, async ({ teamId }) => {
  const admin = await requireAdmin()
  const team = await inTransaction(async () => {
    const t = await unsuspendTeam(admin, teamId)
    await notifyTeam(teamId, { type: 'team.unsuspended', title: `Team ${t.number} is active again`, body: 'Your public page is back and you can pitch again.', href: '/pitches' })
    return t
  })
  invalidateTeam(team)
  return team
})

export const recheckTeamAction = defineAction(teamIdSchema, async ({ teamId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(() => recheckTeamRecord(admin, teamId))
  return { outcome: result.outcome, record: result.record }
})

export const deleteTeamAction = defineAction(z.object({ teamId: z.uuid(), confirmName: z.string().max(200) }), async ({ teamId, confirmName }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(() => deleteTeam(admin, teamId, confirmName))
  after(() => discard('public', result.objects))
  invalidateTeam(result.team)
  return { number: result.team.number, redirectTo: '/admin/directory' }
})

// ─── Reports ────────────────────────────────────────────────────────────────────────────

export const resolveReportAction = defineAction(z.object({ reportId: z.uuid(), suspendTeam: z.boolean() }), async ({ reportId, suspendTeam: suspend }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const report = await resolveReport(admin, reportId)
    if (!suspend) return { suspended: null }
    const r = await suspendTeam(admin, report.teamId)
    await notifyTeam(report.teamId, { type: 'team.suspended', title: `Team ${r.team.number} is suspended`, body: 'Its public page is hidden after a report was reviewed.', href: '/pitches' })
    return { suspended: r.team }
  })
  if (result.suspended) invalidateTeam(result.suspended)
  return { suspendedTeam: result.suspended?.number ?? null }
})

// ─── People ─────────────────────────────────────────────────────────────────────────────

export const setAdminAction = defineAction(z.object({ userId: z.uuid(), grant: z.boolean() }), async ({ userId, grant }) => {
  const admin = await requireAdmin()
  const person = await inTransaction(async () => {
    const p = await setAdmin(admin, userId, grant)
    await notifyUsers([userId], { type: grant ? 'user.admin_granted' : 'user.admin_revoked', title: grant ? 'You’re now an FTC Pitfund admin' : 'Your admin access was removed', href: grant ? '/admin' : '/account' })
    return p
  })
  return { name: person.label, grant }
})

export const setUserSuspendedAction = defineAction(z.object({ userId: z.uuid(), suspended: z.boolean() }), async ({ userId, suspended }) => {
  const admin = await requireAdmin()
  const person = await inTransaction(() => setUserSuspended(admin, userId, suspended))
  return { name: person.label, suspended }
})

export const removeFromOrgAction = defineAction(userIdSchema, async ({ userId }) => {
  const admin = await requireAdmin()
  const result = await inTransaction(async () => {
    const r = await removeFromOrg(admin, userId)
    await notifyUsers([userId], { type: 'org.member_removed', title: 'An FTC Pitfund admin removed you from your team or company', body: 'Write to the support email if you think this is a mistake.', href: '/welcome' })
    return r
  })
  return { name: result.person.label }
})

// ─── System ─────────────────────────────────────────────────────────────────────────────

const emailIdSchema = z.object({ id: z.uuid() })

export const retryEmailAction = defineAction(emailIdSchema, async ({ id }) => {
  await requireAdmin()
  const row = await inTransaction(() => requeueEmail(id))
  await scheduleDrain()
  return row
})

export const dismissEmailAction = defineAction(emailIdSchema, async ({ id }) => {
  await requireAdmin()
  return inTransaction(() => dismissEmail(id))
})

export const sendEmailNowAction = defineAction(emailIdSchema, async ({ id }) => {
  await requireAdmin()
  const row = await inTransaction(() => makeEmailDue(id))
  const outcome = await sendNow(row.id)
  if (outcome === 'failed') throw new AppError('UNAVAILABLE', `The email to ${row.to} couldn’t be sent. It’s listed under Failed with the reason.`)
  return { to: row.to, outcome }
})
