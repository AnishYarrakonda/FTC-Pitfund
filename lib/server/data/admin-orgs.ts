import 'server-only'

import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { questionsFor, type Question } from '@/lib/shared/questions'
import type { PitchStatus, OrgStatus, SupportType } from '@/lib/shared/types'
import type { Viewer } from '@/lib/shared/viewer'

import { audit } from '../audit'
import { getDb } from '../db'
import { lookupFtcTeam } from '../ftc-records'
import { AppError } from '../result'
import { auditEvents, ftcTeamCache, pitches, reports, sponsorMembers, sponsors, teamMembers, teams, users } from '../schema'
import { publicUrl, signedProofUrl } from '../storage'
import { companyRecipients } from './company'
import { teamRecipients } from './teams'

/*
 * Admin actions on companies, teams, reports and people (prompt 3, scope D). Every function takes
 * the admin viewer (from requireAdmin) and audits what it changed. State changes are
 * `UPDATE … WHERE <expected state> RETURNING`; zero rows is a CONFLICT with a human message.
 */

const personName = (u: { name: string; email: string }) => u.name.trim() || u.email

// ─── Companies ──────────────────────────────────────────────────────────────────────────

export type AdminCompany = {
  id: string
  name: string
  website: string
  logoUrl: string | null
  city: string | null
  state: string | null
  region: string | null
  about: string | null
  supportTypes: SupportType[]
  questions: Question[]
  usesDefaultQuestions: boolean
  status: OrgStatus
  statusNote: string | null
  decidedByName: string | null
  decidedAt: Date | null
  createdAt: Date
  applicant: { name: string; email: string; jobTitle: string | null; linkedin: string | null } | null
  members: Array<{ userId: string; name: string; email: string; jobTitle: string | null; joinedAt: Date }>
  pitchCounts: Partial<Record<PitchStatus, number>>
}

export async function getCompanyForAdmin(_admin: Viewer, sponsorId: string): Promise<AdminCompany> {
  const db = getDb()
  const [row] = await db
    .select({
      sponsor: sponsors,
      decidedByName: sql<string | null>`(select coalesce(nullif(u.name, ''), u.email) from ${users} u where u.id = "sponsors"."decided_by")`,
      creatorId: sql<string | null>`(select e.actor_id from ${auditEvents} e where e.entity_type = 'sponsor' and e.entity_id = "sponsors"."id" and e.action = 'sponsor.created' order by e.created_at asc limit 1)`,
    })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND', "That company doesn't exist.")
  const [members, counts] = await Promise.all([
    db
      .select({ userId: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle, joinedAt: sponsorMembers.createdAt })
      .from(sponsorMembers)
      .innerJoin(users, eq(users.id, sponsorMembers.userId))
      .where(eq(sponsorMembers.sponsorId, sponsorId))
      .orderBy(asc(sponsorMembers.createdAt)),
    db.select({ status: pitches.status, n: count() }).from(pitches).where(eq(pitches.sponsorId, sponsorId)).groupBy(pitches.status),
  ])
  const { sponsor } = row
  const applicantRow = members.find((m) => m.userId === row.creatorId) ?? members[0]
  return {
    id: sponsor.id,
    name: sponsor.name,
    website: sponsor.website,
    logoUrl: publicUrl(sponsor.logoPath),
    city: sponsor.city,
    state: sponsor.state,
    region: sponsor.region,
    about: sponsor.about,
    supportTypes: sponsor.supportTypes,
    questions: questionsFor(sponsor),
    usesDefaultQuestions: sponsor.questions.length === 0,
    status: sponsor.status,
    statusNote: sponsor.statusNote,
    decidedByName: row.decidedByName,
    decidedAt: sponsor.decidedAt,
    createdAt: sponsor.createdAt,
    applicant: applicantRow
      ? { name: personName(applicantRow), email: applicantRow.email, jobTitle: sponsor.applicantTitle ?? applicantRow.jobTitle, linkedin: sponsor.applicantLinkedin }
      : null,
    members: members.map((m) => ({ ...m, name: personName(m) })),
    pitchCounts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
  }
}

/** Said back to an admin whose decision lost a race with someone else's. */
const ORG_STATE_PHRASE: Record<OrgStatus, string> = {
  draft: 'hasn’t been submitted for review yet',
  pending: 'is waiting for approval',
  approved: 'is already approved',
  rejected: 'was already rejected',
  suspended: 'is already suspended',
}

async function setCompanyStatus(admin: Viewer, sponsorId: string, from: OrgStatus[], to: OrgStatus, note: string | null, action: string, now: Date) {
  const [row] = await getDb()
    .update(sponsors)
    .set({ status: to, statusNote: note, decidedBy: admin.id, decidedAt: now, updatedAt: now })
    .where(and(eq(sponsors.id, sponsorId), inArray(sponsors.status, from)))
    .returning({ id: sponsors.id, name: sponsors.name, status: sponsors.status })
  if (!row) {
    const [current] = await getDb().select({ name: sponsors.name, status: sponsors.status }).from(sponsors).where(eq(sponsors.id, sponsorId))
    if (!current) throw new AppError('NOT_FOUND', "That company doesn't exist anymore.")
    throw new AppError('CONFLICT', `${current.name} ${ORG_STATE_PHRASE[current.status]}. Refresh to see its current state.`)
  }
  await audit({ actorId: admin.id, action, entityType: 'sponsor', entityId: sponsorId, data: note ? { note } : {} })
  const members = await companyRecipients(sponsorId)
  return { company: row, members }
}

export const approveCompany = (admin: Viewer, sponsorId: string, now = new Date()) =>
  setCompanyStatus(admin, sponsorId, ['pending', 'rejected'], 'approved', null, 'sponsor.approved', now)

export const rejectCompany = (admin: Viewer, sponsorId: string, note: string, now = new Date()) =>
  setCompanyStatus(admin, sponsorId, ['pending'], 'rejected', note, 'sponsor.rejected', now)

export const suspendCompany = (admin: Viewer, sponsorId: string, now = new Date()) =>
  setCompanyStatus(admin, sponsorId, ['approved', 'pending'], 'suspended', null, 'sponsor.suspended', now)

export const unsuspendCompany = (admin: Viewer, sponsorId: string, now = new Date()) =>
  setCompanyStatus(admin, sponsorId, ['suspended'], 'approved', null, 'sponsor.unsuspended', now)

// ─── Teams ──────────────────────────────────────────────────────────────────────────────

export type AdminTeam = {
  id: string
  number: number
  name: string
  location: string | null
  country: string | null
  website: string | null
  instagram: string | null
  summary: string | null
  logoUrl: string | null
  deck: { url: string; pages: number; bytes: number | null; updatedAt: Date | null } | null
  /** The screenshot the coach uploaded to show they are on this team's roster. Signed, short-lived. */
  proofUrl: string | null
  proofUploadedAt: Date | null
  recordStatus: 'matched' | 'manual' | 'unchecked'
  record: { name: string; city: string | null; state: string | null; source: string; fetchedAt: Date } | null
  status: OrgStatus
  statusNote: string | null
  decidedByName: string | null
  decidedAt: Date | null
  submittedAt: Date | null
  suspendedAt: Date | null
  createdAt: Date
  members: Array<{ userId: string; name: string; email: string; phone: string | null; joinedAt: Date }>
  pitches: Array<{ id: string; companyName: string; status: PitchStatus; updatedAt: Date }>
  openReports: number
}

export async function getTeamForAdmin(_admin: Viewer, teamId: string): Promise<AdminTeam> {
  const db = getDb()
  const [row] = await db
    .select({
      team: teams,
      decidedByName: sql<string | null>`(select coalesce(nullif(u.name, ''), u.email) from ${users} u where u.id = "teams"."decided_by")`,
      openReports: sql<number>`(select count(*)::int from ${reports} r where r.team_id = "teams"."id" and r.status = 'open')`,
      record: { name: ftcTeamCache.name, city: ftcTeamCache.city, state: ftcTeamCache.state, source: ftcTeamCache.source, fetchedAt: ftcTeamCache.fetchedAt },
    })
    .from(teams)
    .leftJoin(ftcTeamCache, eq(ftcTeamCache.number, teams.number))
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND', "That team doesn't exist.")
  const [members, teamPitches] = await Promise.all([
    db
      .select({ userId: users.id, name: users.name, email: users.email, phone: users.phone, joinedAt: teamMembers.createdAt })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(teamMembers.createdAt)),
    db
      .select({ id: pitches.id, companyName: sponsors.name, status: pitches.status, updatedAt: pitches.updatedAt })
      .from(pitches)
      .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
      .where(and(eq(pitches.teamId, teamId), sql`${pitches.status} <> 'draft'`))
      .orderBy(desc(pitches.updatedAt))
      .limit(30),
  ])
  const { team } = row
  const deckUrl = publicUrl(team.pdfPath)
  return {
    id: team.id,
    number: team.number,
    name: team.name,
    location: team.location,
    country: team.country,
    website: team.website,
    instagram: team.instagram,
    summary: team.summary,
    logoUrl: publicUrl(team.logoPath),
    deck: deckUrl && team.pdfPages ? { url: deckUrl, pages: team.pdfPages, bytes: team.pdfBytes, updatedAt: team.pdfUpdatedAt } : null,
    proofUrl: await signedProofUrl(team.proofPath),
    proofUploadedAt: team.proofUploadedAt,
    recordStatus: team.recordStatus,
    record: row.record?.name ? row.record : null,
    status: team.status,
    statusNote: team.statusNote,
    decidedByName: row.decidedByName,
    decidedAt: team.decidedAt,
    submittedAt: team.submittedAt,
    suspendedAt: team.suspendedAt,
    createdAt: team.createdAt,
    members: members.map((m) => ({ ...m, name: personName(m) })),
    pitches: teamPitches,
    openReports: Number(row.openReports ?? 0),
  }
}

type TeamRef = { id: string; number: number; name: string }

async function teamRef(teamId: string): Promise<TeamRef> {
  const [team] = await getDb().select({ id: teams.id, number: teams.number, name: teams.name }).from(teams).where(eq(teams.id, teamId))
  if (!team) throw new AppError('NOT_FOUND', "That team doesn't exist anymore.")
  return team
}

/**
 * Teams move through the same gate as companies. The conditional UPDATE is the transition guard: two
 * admins deciding the same team at once means the second one gets a CONFLICT instead of overwriting.
 */
async function setTeamStatus(admin: Viewer, teamId: string, from: OrgStatus[], to: OrgStatus, note: string | null, action: string, now: Date) {
  const [row] = await getDb()
    .update(teams)
    .set({ status: to, statusNote: note, decidedBy: admin.id, decidedAt: now, updatedAt: now })
    .where(and(eq(teams.id, teamId), inArray(teams.status, from)))
    .returning({ id: teams.id, number: teams.number, name: teams.name, status: teams.status })
  if (!row) {
    const [current] = await getDb().select({ number: teams.number, status: teams.status }).from(teams).where(eq(teams.id, teamId))
    if (!current) throw new AppError('NOT_FOUND', "That team doesn't exist anymore.")
    throw new AppError('CONFLICT', `Team ${current.number} ${ORG_STATE_PHRASE[current.status]}. Refresh to see its current state.`)
  }
  await audit({ actorId: admin.id, action, entityType: 'team', entityId: teamId, data: note ? { note } : {} })
  const members = await teamRecipients(teamId)
  return { team: row, members }
}

/**
 * Approving is also when the verification screenshot stops being needed, and the upload page
 * promises it is deleted then. The row is cleared here; the object itself is handed back so the
 * action can remove it from the bucket once the transaction has committed.
 */
export async function approveTeam(admin: Viewer, teamId: string, now = new Date()) {
  const [before] = await getDb().select({ proofPath: teams.proofPath }).from(teams).where(eq(teams.id, teamId))
  const result = await setTeamStatus(admin, teamId, ['pending', 'rejected'], 'approved', null, 'team.approved', now)
  if (before?.proofPath) {
    await getDb().update(teams).set({ proofPath: null, proofBytes: null, proofUploadedAt: null }).where(eq(teams.id, teamId))
  }
  return { ...result, proofPath: before?.proofPath ?? null }
}

export const rejectTeam = (admin: Viewer, teamId: string, note: string, now = new Date()) =>
  setTeamStatus(admin, teamId, ['pending'], 'rejected', note, 'team.rejected', now)

/**
 * Suspend a team: its public page disappears, its members can't pitch (authz), and its pitches that
 * are waiting for review are withdrawn so they leave the queue. Returns what changed for notifications.
 */
export async function suspendTeam(admin: Viewer, teamId: string, now = new Date()) {
  const [row] = await getDb()
    .update(teams)
    .set({ suspendedAt: now })
    .where(and(eq(teams.id, teamId), isNull(teams.suspendedAt)))
    .returning({ id: teams.id, number: teams.number, name: teams.name })
  if (!row) {
    const team = await teamRef(teamId)
    throw new AppError('CONFLICT', `Team ${team.number} is already suspended.`)
  }
  const withdrawn = await getDb()
    .update(pitches)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(and(eq(pitches.teamId, teamId), eq(pitches.status, 'in_review')))
    .returning({ id: pitches.id, sponsorId: pitches.sponsorId })
  await audit([
    { actorId: admin.id, action: 'team.suspended', entityType: 'team', entityId: teamId, data: { withdrawnPitches: withdrawn.length } },
    ...withdrawn.map((p) => ({ actorId: admin.id, action: 'pitch.withdrawn', entityType: 'pitch' as const, entityId: p.id, data: { from: 'in_review', reason: 'team_suspended' } })),
  ])
  return { team: row, withdrawn }
}

export async function unsuspendTeam(admin: Viewer, teamId: string) {
  const [row] = await getDb()
    .update(teams)
    .set({ suspendedAt: null })
    .where(and(eq(teams.id, teamId), isNotNull(teams.suspendedAt)))
    .returning({ id: teams.id, number: teams.number, name: teams.name })
  if (!row) {
    const team = await teamRef(teamId)
    throw new AppError('CONFLICT', `Team ${team.number} isn’t suspended.`)
  }
  await audit({ actorId: admin.id, action: 'team.unsuspended', entityType: 'team', entityId: teamId })
  return row
}

type RecheckOutcome = 'matched' | 'not_found' | 'unavailable'

/** Look the team up in FIRST records again and record what was found. */
export async function recheckTeamRecord(actor: Viewer | null, teamId: string, options: Parameters<typeof lookupFtcTeam>[1] = {}) {
  const team = await teamRef(teamId)
  const result = await lookupFtcTeam(team.number, options)
  let outcome: RecheckOutcome = 'unavailable'
  if (result.status === 'found') outcome = 'matched'
  if (result.status === 'not_found') outcome = 'not_found'
  if (outcome !== 'unavailable') {
    await getDb()
      .update(teams)
      .set({ recordStatus: outcome === 'matched' ? 'matched' : 'manual' })
      .where(eq(teams.id, teamId))
    await audit({ actorId: actor?.id ?? null, action: 'team.record_checked', entityType: 'team', entityId: teamId, data: { outcome } })
  }
  return { team, outcome, record: result.status === 'found' ? result.record : null }
}

// ─── Reports ────────────────────────────────────────────────────────────────────────────

export async function resolveReport(admin: Viewer, reportId: string, now = new Date()) {
  const [row] = await getDb()
    .update(reports)
    .set({ status: 'resolved', resolvedBy: admin.id, resolvedAt: now, updatedAt: now })
    .where(and(eq(reports.id, reportId), eq(reports.status, 'open')))
    .returning({ id: reports.id, teamId: reports.teamId })
  if (!row) {
    const [exists] = await getDb().select({ id: reports.id }).from(reports).where(eq(reports.id, reportId))
    if (!exists) throw new AppError('NOT_FOUND', "That report doesn't exist anymore.")
    throw new AppError('CONFLICT', 'Another admin already resolved this report.')
  }
  await audit({ actorId: admin.id, action: 'report.resolved', entityType: 'report', entityId: reportId, data: { teamId: row.teamId } })
  return row
}

// ─── People ─────────────────────────────────────────────────────────────────────────────

async function personRef(userId: string) {
  const [person] = await getDb()
    .select({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.id, userId))
  if (!person) throw new AppError('NOT_FOUND', "That person doesn't have an account anymore.")
  return { ...person, label: personName(person) }
}

export async function setAdmin(admin: Viewer, userId: string, grant: boolean) {
  if (!grant && userId === admin.id) throw new AppError('FORBIDDEN', 'You can’t remove your own admin access. Ask another admin.')
  const person = await personRef(userId)
  const [row] = await getDb()
    .update(users)
    .set({ isAdmin: grant })
    .where(and(eq(users.id, userId), eq(users.isAdmin, !grant)))
    .returning({ id: users.id })
  if (!row) throw new AppError('CONFLICT', grant ? `${person.label} is already an admin.` : `${person.label} isn’t an admin.`)
  await audit({ actorId: admin.id, action: grant ? 'user.admin_granted' : 'user.admin_revoked', entityType: 'user', entityId: userId })
  return person
}

export async function setUserSuspended(admin: Viewer, userId: string, suspended: boolean, now = new Date()) {
  if (userId === admin.id) throw new AppError('FORBIDDEN', 'You can’t suspend yourself.')
  const person = await personRef(userId)
  const [row] = await getDb()
    .update(users)
    .set({ suspendedAt: suspended ? now : null })
    .where(and(eq(users.id, userId), suspended ? isNull(users.suspendedAt) : isNotNull(users.suspendedAt)))
    .returning({ id: users.id })
  if (!row) throw new AppError('CONFLICT', suspended ? `${person.label} is already suspended.` : `${person.label} isn’t suspended.`)
  await audit({ actorId: admin.id, action: suspended ? 'user.suspended' : 'user.unsuspended', entityType: 'user', entityId: userId })
  return person
}

/** Remove a person from their team or company (an admin may remove the last member). */
export async function removeFromOrg(admin: Viewer, userId: string) {
  const person = await personRef(userId)
  const db = getDb()
  const team = await db.delete(teamMembers).where(eq(teamMembers.userId, userId)).returning({ teamId: teamMembers.teamId })
  const company = await db.delete(sponsorMembers).where(eq(sponsorMembers.userId, userId)).returning({ sponsorId: sponsorMembers.sponsorId })
  if (!team[0] && !company[0]) throw new AppError('CONFLICT', `${person.label} isn’t on a team or company.`)
  if (team[0]) await audit({ actorId: admin.id, action: 'team.member_removed', entityType: 'team', entityId: team[0].teamId, data: { userId, by: 'admin' } })
  if (company[0]) await audit({ actorId: admin.id, action: 'sponsor.member_removed', entityType: 'sponsor', entityId: company[0].sponsorId, data: { userId, by: 'admin' } })
  return { person, teamId: team[0]?.teamId ?? null, sponsorId: company[0]?.sponsorId ?? null }
}

// ─── Deleting ───────────────────────────────────────────────────────────────────────────

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Delete a team and everything that cascades from it. Returns the storage objects to remove after commit. */
export async function deleteTeam(admin: Viewer, teamId: string, confirmName: string) {
  const [team] = await getDb()
    .select({ id: teams.id, number: teams.number, name: teams.name, logoPath: teams.logoPath, pdfPath: teams.pdfPath, pdfThumbPath: teams.pdfThumbPath })
    .from(teams)
    .where(eq(teams.id, teamId))
    .for('update')
  if (!team) throw new AppError('NOT_FOUND', "That team doesn't exist anymore.")
  if (!sameName(confirmName, team.name)) throw new AppError('VALIDATION', `Type ${team.name} exactly to delete this team.`, { field: 'confirmName' })
  await getDb().delete(teams).where(eq(teams.id, teamId))
  await audit({ actorId: admin.id, action: 'team.deleted', entityType: 'team', entityId: teamId, data: { number: team.number, name: team.name } })
  return { team, objects: [team.logoPath, team.pdfPath, team.pdfThumbPath] }
}

export async function deleteCompany(admin: Viewer, sponsorId: string, confirmName: string) {
  const [company] = await getDb().select({ id: sponsors.id, name: sponsors.name, logoPath: sponsors.logoPath }).from(sponsors).where(eq(sponsors.id, sponsorId)).for('update')
  if (!company) throw new AppError('NOT_FOUND', "That company doesn't exist anymore.")
  if (!sameName(confirmName, company.name)) throw new AppError('VALIDATION', `Type ${company.name} exactly to delete this company.`, { field: 'confirmName' })
  await getDb().delete(sponsors).where(eq(sponsors.id, sponsorId))
  await audit({ actorId: admin.id, action: 'sponsor.deleted', entityType: 'sponsor', entityId: sponsorId, data: { name: company.name } })
  return { company, objects: [company.logoPath] }
}
