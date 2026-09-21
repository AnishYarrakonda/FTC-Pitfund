import 'server-only'

import { and, asc, desc, eq, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm'

import type { PitchViewData } from '@/lib/shared/pitch'
import { formatAsk } from '@/lib/shared/pitch'
import type { PitchStatus } from '@/lib/shared/types'

import type { SponsorViewer } from '../authz'
import { audit } from '../audit'
import { getDb } from '../db'
import { absoluteUrl } from '../env'
import { AppError } from '../result'
import { emailOutbox, pitches, sponsors, teamMembers, teams, users, type ContactSnapshot } from '../schema'
import { publicUrl } from '../storage'
import { teamForView } from './pitches'

/*
 * The company pitch inbox (prompt 3, scope C; plan §3.2 "Sponsor response"). A company only ever
 * reads its own pitches with status sent, matched or declined — plus a read-only notice for a
 * pitch that was sent and then withdrawn. Contact snapshots are returned only for matched pitches.
 */

const INBOX_STATUSES: PitchStatus[] = ['sent', 'matched', 'declined']
const NOT_FOUND = "That pitch doesn't exist or wasn't sent to your company."
const GROUP_LIMIT = 100

type InboxRow = {
  id: string
  status: PitchStatus
  team: { number: number; name: string; logoUrl: string | null; verified: boolean; location: string | null; summary: string | null }
  ask: string | null
  receivedAt: Date
  respondedAt: Date | null
}

export type InboxGroups = { sent: InboxRow[]; matched: InboxRow[]; declined: InboxRow[] }

/** /inbox: New · Interested · Not a fit, newest first. One query. */
export async function listInbox(viewer: SponsorViewer): Promise<InboxGroups> {
  const rows = await getDb()
    .select({
      id: pitches.id,
      status: pitches.status,
      sentAt: pitches.sentAt,
      respondedAt: pitches.respondedAt,
      askType: pitches.askType,
      askAmountCents: pitches.askAmountCents,
      askNote: pitches.askNote,
      rank: sql<number>`row_number() over (partition by ${pitches.status} order by coalesce(${pitches.respondedAt}, ${pitches.sentAt}) desc)`,
      team: { number: teams.number, name: teams.name, logoPath: teams.logoPath, status: teams.status, location: teams.location, summary: teams.summary },
    })
    .from(pitches)
    .innerJoin(teams, eq(teams.id, pitches.teamId))
    .where(and(eq(pitches.sponsorId, viewer.sponsor.id), inArray(pitches.status, INBOX_STATUSES)))
    .orderBy(desc(sql`coalesce(${pitches.respondedAt}, ${pitches.sentAt})`))

  const groups: InboxGroups = { sent: [], matched: [], declined: [] }
  for (const r of rows) {
    if (Number(r.rank) > GROUP_LIMIT) continue
    const { logoPath, status, ...team } = r.team
    groups[r.status as keyof InboxGroups].push({
      id: r.id,
      status: r.status,
      team: { ...team, logoUrl: publicUrl(logoPath), verified: status === 'approved' },
      ask: formatAsk({ type: r.askType, amountCents: r.askAmountCents, note: r.askNote }),
      receivedAt: r.sentAt ?? new Date(0),
      respondedAt: r.respondedAt,
    })
  }
  return groups
}

export type InboxPitch = {
  id: string
  status: PitchStatus
  /** Sent, then withdrawn by the team: the page shows a read-only notice and nothing else. */
  withdrawn: boolean
  view: PitchViewData
  deck: { url: string; downloadUrl: string; pages: number; thumbUrl: string | null } | null
  receivedAt: Date | null
  respondedAt: Date | null
  respondedByName: string | null
  declineReason: string | null
  /** The team's contact, only when matched (plan §5 "Security"). */
  contact: ContactSnapshot | null
  /** Delivery of the match or not-a-fit email to the team: 'delayed' (quota) or 'failed', else null. */
  teamEmail: 'delayed' | 'failed' | null
}

async function teamEmailState(pitchId: string, now: Date): Promise<InboxPitch['teamEmail']> {
  const rows = await getDb()
    .select({ template: emailOutbox.template, status: emailOutbox.status, sendAfter: emailOutbox.sendAfter })
    .from(emailOutbox)
    .where(and(like(emailOutbox.dedupeKey, `pitch:${pitchId}:%`), inArray(emailOutbox.template, ['match-team', 'pitch-not-a-fit'])))
  if (rows.some((r) => r.status === 'failed' || r.status === 'bounced')) return 'failed'
  if (rows.some((r) => (r.status === 'queued' || r.status === 'sending') && r.sendAfter.getTime() > now.getTime() + 5 * 60 * 1000)) return 'delayed'
  return null
}

export async function getInboxPitch(viewer: SponsorViewer, pitchId: string, now = new Date()): Promise<InboxPitch> {
  const responder = sql<string | null>`(select coalesce(nullif(u.name, ''), u.email) from ${users} u where u.id = "pitches"."responded_by")`
  const [[row], teamEmail] = await Promise.all([getDb()
    .select({
      pitch: pitches,
      responder,
      team: {
        number: teams.number,
        name: teams.name,
        location: teams.location,
        summary: teams.summary,
        website: teams.website,
        instagram: teams.instagram,
        logoPath: teams.logoPath,
        status: teams.status,
        pdfPath: teams.pdfPath,
        pdfThumbPath: teams.pdfThumbPath,
        pdfPages: teams.pdfPages,
      },
      company: { id: sponsors.id, name: sponsors.name, logoPath: sponsors.logoPath },
    })
    .from(pitches)
    .innerJoin(teams, eq(teams.id, pitches.teamId))
    .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
    .where(
      and(
        eq(pitches.id, pitchId),
        eq(pitches.sponsorId, viewer.sponsor.id),
        or(inArray(pitches.status, INBOX_STATUSES), and(eq(pitches.status, 'withdrawn'), isNotNull(pitches.sentAt))),
      ),
    )
    .limit(1), teamEmailState(pitchId, now)])
  if (!row) throw new AppError('NOT_FOUND', NOT_FOUND)
  const { pitch, team, company } = row
  const withdrawn = pitch.status === 'withdrawn'
  const teamView = teamForView(team)
  const deckUrl = publicUrl(team.pdfPath)
  return {
    id: pitch.id,
    status: pitch.status,
    withdrawn,
    view: {
      team: teamView,
      company: { id: company.id, name: company.name, logoUrl: publicUrl(company.logoPath) },
      // A withdrawn pitch is a notice only: its answers and ask are not shown.
      answers: withdrawn ? [] : pitch.answers,
      ask: withdrawn
        ? { type: 'none', amountCents: null, note: null, label: null }
        : { type: pitch.askType, amountCents: pitch.askAmountCents, note: pitch.askNote, label: formatAsk({ type: pitch.askType, amountCents: pitch.askAmountCents, note: pitch.askNote }) },
      submittedAt: pitch.submittedAt,
    },
    deck:
      !withdrawn && deckUrl && team.pdfPages
        ? {
            url: deckUrl,
            downloadUrl: `${deckUrl}?download=${encodeURIComponent(`Team ${team.number} sponsorship deck.pdf`)}`,
            pages: team.pdfPages,
            thumbUrl: publicUrl(team.pdfThumbPath),
          }
        : null,
    receivedAt: pitch.sentAt,
    respondedAt: pitch.respondedAt,
    respondedByName: row.responder,
    declineReason: pitch.status === 'declined' ? pitch.declineReason : null,
    contact: pitch.status === 'matched' ? pitch.teamContact : null,
    teamEmail: pitch.status === 'matched' || pitch.status === 'declined' ? teamEmail : null,
  }
}

// ─── Responding ─────────────────────────────────────────────────────────────────────────

async function lockOwnPitch(viewer: SponsorViewer, pitchId: string) {
  const [current] = await getDb()
    .select({ id: pitches.id, status: pitches.status, teamId: pitches.teamId, submittedBy: pitches.submittedBy, createdBy: pitches.createdBy, sentAt: pitches.sentAt })
    .from(pitches)
    .where(and(eq(pitches.id, pitchId), eq(pitches.sponsorId, viewer.sponsor.id)))
    .for('update')
  if (!current || !(INBOX_STATUSES.includes(current.status) || (current.status === 'withdrawn' && current.sentAt))) {
    throw new AppError('NOT_FOUND', NOT_FOUND)
  }
  return current
}

async function teamFacts(teamId: string) {
  const [team] = await getDb().select({ id: teams.id, number: teams.number, name: teams.name }).from(teams).where(eq(teams.id, teamId))
  return team
}

function notOpen(status: PitchStatus, team: { number: number; name: string }) {
  if (status === 'withdrawn') return new AppError('CONFLICT', `Team ${team.number} · ${team.name} withdrew this pitch.`)
  if (status === 'matched') return new AppError('CONFLICT', 'Someone at your company already said you’re interested in this pitch.')
  return new AppError('CONFLICT', 'Someone at your company already marked this pitch not a fit.')
}

/**
 * The coach who submitted the pitch, else whoever created it, else the team's oldest current member.
 * Only people who are on the team now and not suspended qualify: their contact details go to the
 * company and the company's contact details come back to them, so a coach who left, was removed or was
 * suspended after submitting must not receive either.
 */
async function submittingCoach(pitch: { teamId: string; submittedBy: string | null; createdBy: string | null }) {
  const candidates = [pitch.submittedBy, pitch.createdBy].filter((v): v is string => Boolean(v))
  const current = getDb()
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
  if (candidates.length) {
    const rows = await current.where(and(eq(teamMembers.teamId, pitch.teamId), inArray(users.id, candidates), isNull(users.suspendedAt)))
    const preferred = candidates.map((id) => rows.find((r) => r.id === id)).find(Boolean)
    if (preferred) return preferred
  }
  const [anyMember] = await getDb()
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(and(eq(teamMembers.teamId, pitch.teamId), isNull(users.suspendedAt)))
    .orderBy(asc(teamMembers.createdAt))
    .limit(1)
  return anyMember ?? null
}

export async function respondInterested(viewer: SponsorViewer, pitchId: string, now = new Date()) {
  const current = await lockOwnPitch(viewer, pitchId)
  const team = await teamFacts(current.teamId)
  if (current.status !== 'sent') throw notOpen(current.status, team)

  const [coach, [company], [responder]] = await Promise.all([
    submittingCoach(current),
    getDb().select({ name: sponsors.name, website: sponsors.website }).from(sponsors).where(eq(sponsors.id, viewer.sponsor.id)),
    getDb().select({ name: users.name, email: users.email, phone: users.phone, jobTitle: users.jobTitle }).from(users).where(eq(users.id, viewer.id)),
  ])
  const teamContact: ContactSnapshot = {
    name: coach?.name.trim() || coach?.email || `Team ${team.number}`,
    email: coach?.email ?? '',
    phone: coach?.phone ?? null,
    teamName: team.name,
    teamNumber: team.number,
    teamUrl: absoluteUrl(`/t/${team.number}`),
  }
  const sponsorContact: ContactSnapshot = {
    name: responder.name.trim() || responder.email,
    email: responder.email,
    phone: responder.phone,
    jobTitle: responder.jobTitle,
    companyName: company.name,
    website: company.website,
  }

  const [row] = await getDb()
    .update(pitches)
    .set({ status: 'matched', respondedBy: viewer.id, respondedAt: now, teamContact, sponsorContact, updatedAt: now })
    .where(and(eq(pitches.id, pitchId), eq(pitches.sponsorId, viewer.sponsor.id), eq(pitches.status, 'sent')))
    .returning({ id: pitches.id })
  if (!row) throw notOpen((await lockOwnPitch(viewer, pitchId)).status, team)

  await audit({ actorId: viewer.id, action: 'pitch.matched', entityType: 'pitch', entityId: pitchId })
  return { pitchId, team, company: { id: viewer.sponsor.id, name: company.name }, coach: coach ? { id: coach.id, email: coach.email, name: teamContact.name } : null, teamContact, sponsorContact }
}

export async function respondNotAFit(viewer: SponsorViewer, pitchId: string, reason: string | null, now = new Date()) {
  const current = await lockOwnPitch(viewer, pitchId)
  const team = await teamFacts(current.teamId)
  if (current.status !== 'sent') throw notOpen(current.status, team)
  const [row] = await getDb()
    .update(pitches)
    .set({ status: 'declined', respondedBy: viewer.id, respondedAt: now, declineReason: reason, updatedAt: now })
    .where(and(eq(pitches.id, pitchId), eq(pitches.sponsorId, viewer.sponsor.id), eq(pitches.status, 'sent')))
    .returning({ id: pitches.id })
  if (!row) throw notOpen((await lockOwnPitch(viewer, pitchId)).status, team)
  await audit({ actorId: viewer.id, action: 'pitch.declined', entityType: 'pitch', entityId: pitchId, data: reason ? { reason } : {} })
  const coach = await submittingCoach(current)
  return { pitchId, team, companyName: viewer.sponsor.name, coach: coach ? { id: coach.id, email: coach.email } : null }
}
