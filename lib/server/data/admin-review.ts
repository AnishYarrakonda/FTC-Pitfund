import 'server-only'

import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'

import { formatAsk, type PitchViewData } from '@/lib/shared/pitch'
import type { PitchStatus, SponsorStatus } from '@/lib/shared/types'
import type { Viewer } from '@/lib/shared/viewer'

import { audit } from '../audit'
import { getDb } from '../db'
import { AppError } from '../result'
import { ftcTeamCache, pitches, reports, sponsorMembers, sponsors, teamMembers, teams, users } from '../schema'
import { publicUrl } from '../storage'
import { companyRecipients } from './company'
import { keyset, type Page, type PageParams } from './keyset'
import { teamForView } from './pitches'

/*
 * The admin review queue (prompt 3, scope D; plan §3.2 "Admin review"): counts, the four tabs,
 * the full-page pitch review and its decisions. Decisions are `UPDATE … WHERE status = 'in_review'
 * RETURNING`; losing a race to another admin is a CONFLICT that names who decided and how.
 */

export const WAITING_WARNING_MS = 24 * 60 * 60 * 1000

export type ReviewCounts = { pitches: number; companies: number; teams: number; reports: number }

/** The four tab counts in one query. */
export async function reviewCounts(): Promise<ReviewCounts> {
  const [row] = await getDb().execute<{ pitches: number; companies: number; teams: number; reports: number }>(sql`
    select
      (select count(*)::int from ${pitches} where status = 'in_review') as pitches,
      (select count(*)::int from ${sponsors} where status = 'pending') as companies,
      (select count(*)::int from ${teams} where verified_at is null and suspended_at is null) as teams,
      (select count(*)::int from ${reports} where status = 'open') as reports
  `)
  return { pitches: Number(row.pitches), companies: Number(row.companies), teams: Number(row.teams), reports: Number(row.reports) }
}

// ─── Tabs ───────────────────────────────────────────────────────────────────────────────

export type QueuePitch = {
  id: string
  submittedAt: Date
  team: { number: number; name: string; logoUrl: string | null; verified: boolean }
  company: { name: string; logoUrl: string | null; status: SponsorStatus }
  resubmission: boolean
}

export async function listPitchQueue(params: PageParams): Promise<Page<QueuePitch>> {
  const k = keyset<{ cursor: string; id: string }>({
    key: sql`(${pitches.submittedAt}, ${pitches.id})`,
    columns: [sql`${pitches.submittedAt}`, sql`${pitches.id}`],
    direction: 'asc',
    params,
    casts: ['::timestamptz', '::uuid'],
    cursorOf: (r) => [r.cursor, r.id],
  })
  const rows = await getDb()
    .select({
      id: pitches.id,
      cursor: sql<string>`${pitches.submittedAt}::text`,
      submittedAt: pitches.submittedAt,
      team: { number: teams.number, name: teams.name, logoPath: teams.logoPath, verifiedAt: teams.verifiedAt },
      company: { name: sponsors.name, logoPath: sponsors.logoPath, status: sponsors.status },
      resubmission: sql<boolean>`exists (select 1 from audit_events e where e.entity_type = 'pitch' and e.entity_id = "pitches"."id" and e.action = 'pitch.sent_back')`,
    })
    .from(pitches)
    .innerJoin(teams, eq(teams.id, pitches.teamId))
    .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
    .where(and(eq(pitches.status, 'in_review'), k.condition))
    .orderBy(...k.orderBy)
    .limit(k.limit)
  const page = k.page(rows)
  return {
    ...page,
    items: page.items.map((r) => ({
      id: r.id,
      submittedAt: r.submittedAt ?? new Date(0),
      team: { number: r.team.number, name: r.team.name, logoUrl: publicUrl(r.team.logoPath), verified: Boolean(r.team.verifiedAt) },
      company: { name: r.company.name, logoUrl: publicUrl(r.company.logoPath), status: r.company.status },
      resubmission: Boolean(r.resubmission),
    })),
  }
}

export type QueueCompany = { id: string; name: string; website: string; logoUrl: string | null; applicantName: string | null; applicantTitle: string | null; createdAt: Date }

const applicantName = sql<string | null>`(
  select coalesce(nullif(u.name, ''), u.email) from ${sponsorMembers} m join ${users} u on u.id = m.user_id
  where m.sponsor_id = "sponsors"."id" order by m.created_at asc limit 1
)`

export async function listPendingCompanies(params: PageParams): Promise<Page<QueueCompany>> {
  const k = keyset<{ cursor: string; id: string }>({
    key: sql`(${sponsors.createdAt}, ${sponsors.id})`,
    columns: [sql`${sponsors.createdAt}`, sql`${sponsors.id}`],
    direction: 'asc',
    params,
    casts: ['::timestamptz', '::uuid'],
    cursorOf: (r) => [r.cursor, r.id],
  })
  const rows = await getDb()
    .select({
      id: sponsors.id,
      cursor: sql<string>`${sponsors.createdAt}::text`,
      name: sponsors.name,
      website: sponsors.website,
      logoPath: sponsors.logoPath,
      applicantName,
      applicantTitle: sponsors.applicantTitle,
      createdAt: sponsors.createdAt,
    })
    .from(sponsors)
    .where(and(eq(sponsors.status, 'pending'), k.condition))
    .orderBy(...k.orderBy)
    .limit(k.limit)
  const page = k.page(rows)
  return { ...page, items: page.items.map(({ cursor: _cursor, logoPath, ...r }) => ({ ...r, logoUrl: publicUrl(logoPath) })) }
}

export type QueueTeam = { id: string; number: number; name: string; city: string | null; state: string | null; logoUrl: string | null; recordStatus: 'matched' | 'manual' | 'unchecked'; hasDeck: boolean; createdAt: Date }

export async function listUnverifiedTeams(params: PageParams): Promise<Page<QueueTeam>> {
  const k = keyset<{ cursor: string; id: string }>({
    key: sql`(${teams.createdAt}, ${teams.id})`,
    columns: [sql`${teams.createdAt}`, sql`${teams.id}`],
    direction: 'desc',
    params,
    casts: ['::timestamptz', '::uuid'],
    cursorOf: (r) => [r.cursor, r.id],
  })
  const rows = await getDb()
    .select({
      id: teams.id,
      cursor: sql<string>`${teams.createdAt}::text`,
      number: teams.number,
      name: teams.name,
      city: teams.city,
      state: teams.state,
      logoPath: teams.logoPath,
      recordStatus: teams.recordStatus,
      hasDeck: sql<boolean>`${teams.pdfPath} is not null`,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .where(and(isNull(teams.verifiedAt), isNull(teams.suspendedAt), k.condition))
    .orderBy(...k.orderBy)
    .limit(k.limit)
  const page = k.page(rows)
  return { ...page, items: page.items.map(({ cursor: _cursor, logoPath, ...r }) => ({ ...r, hasDeck: Boolean(r.hasDeck), logoUrl: publicUrl(logoPath) })) }
}

export type OpenReport = {
  id: string
  reason: string
  details: string | null
  createdAt: Date
  reporter: string | null
  team: { id: string; number: number; name: string; logoUrl: string | null; suspended: boolean }
}

export async function listOpenReports(params: PageParams): Promise<Page<OpenReport>> {
  const k = keyset<{ cursor: string; id: string }>({
    key: sql`(${reports.createdAt}, ${reports.id})`,
    columns: [sql`${reports.createdAt}`, sql`${reports.id}`],
    direction: 'asc',
    params,
    casts: ['::timestamptz', '::uuid'],
    cursorOf: (r) => [r.cursor, r.id],
  })
  const rows = await getDb()
    .select({
      id: reports.id,
      cursor: sql<string>`${reports.createdAt}::text`,
      reason: reports.reason,
      details: reports.details,
      createdAt: reports.createdAt,
      reporter: sql<string | null>`coalesce((select coalesce(nullif(u.name, ''), u.email) from ${users} u where u.id = "reports"."reporter_user_id"), "reports"."reporter_email")`,
      team: { id: teams.id, number: teams.number, name: teams.name, logoPath: teams.logoPath, suspendedAt: teams.suspendedAt },
    })
    .from(reports)
    .innerJoin(teams, eq(teams.id, reports.teamId))
    .where(and(eq(reports.status, 'open'), k.condition))
    .orderBy(...k.orderBy)
    .limit(k.limit)
  const page = k.page(rows)
  return {
    ...page,
    items: page.items.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      createdAt: r.createdAt,
      reporter: r.reporter,
      team: { id: r.team.id, number: r.team.number, name: r.team.name, logoUrl: publicUrl(r.team.logoPath), suspended: Boolean(r.team.suspendedAt) },
    })),
  }
}

// ─── Pitch review page ──────────────────────────────────────────────────────────────────

export type PitchReview = {
  id: string
  status: PitchStatus
  submittedAt: Date | null
  reviewNote: string | null
  reviewedByName: string | null
  reviewedAt: Date | null
  resubmission: boolean
  view: PitchViewData
  deck: { url: string; downloadUrl: string; pages: number; thumbUrl: string | null } | null
  team: {
    id: string
    number: number
    name: string
    verified: boolean
    suspended: boolean
    createdAt: Date
    recordStatus: 'matched' | 'manual' | 'unchecked'
    record: { name: string; city: string | null; state: string | null } | null
    members: Array<{ name: string; email: string }>
    otherPitches: Array<{ id: string; companyName: string; status: PitchStatus }>
  }
  company: { id: string; name: string; website: string; logoUrl: string | null; status: SponsorStatus; memberCount: number; questionCount: number }
  /** Why Approve & send is blocked, if it is. */
  approvalBlocker: string | null
  queue: { position: number | null; total: number; previousId: string | null; nextId: string | null }
}

export function approvalBlocker(team: { number: number; suspended: boolean }, company: { name: string; status: SponsorStatus }): string | null {
  if (company.status !== 'approved') {
    const state = company.status === 'pending' ? 'isn’t approved yet' : company.status === 'rejected' ? 'wasn’t approved' : 'is suspended'
    return `${company.name} ${state}, so it can’t receive pitches.`
  }
  if (team.suspended) return `Team ${team.number} is suspended, so its pitches can’t be sent.`
  return null
}

export async function getPitchReview(_admin: Viewer, pitchId: string): Promise<PitchReview> {
  const db = getDb()
  const [row] = await db
    .select({
      pitch: pitches,
      reviewer: sql<string | null>`(select coalesce(nullif(u.name, ''), u.email) from ${users} u where u.id = "pitches"."reviewed_by")`,
      resubmission: sql<boolean>`exists (select 1 from audit_events e where e.entity_type = 'pitch' and e.entity_id = "pitches"."id" and e.action = 'pitch.sent_back')`,
      team: teams,
      company: sponsors,
    })
    .from(pitches)
    .innerJoin(teams, eq(teams.id, pitches.teamId))
    .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
    .where(eq(pitches.id, pitchId))
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND', "That pitch doesn't exist.")
  const { pitch, team, company } = row

  const [members, others, [record], [companyCounts], neighbours] = await Promise.all([
    db
      .select({ name: users.name, email: users.email })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, team.id))
      .orderBy(asc(teamMembers.createdAt)),
    db
      .select({ id: pitches.id, companyName: sponsors.name, status: pitches.status })
      .from(pitches)
      .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
      .where(and(eq(pitches.teamId, team.id), ne(pitches.id, pitch.id), ne(pitches.status, 'draft')))
      .orderBy(desc(pitches.updatedAt))
      .limit(20),
    db.select({ name: ftcTeamCache.name, city: ftcTeamCache.city, state: ftcTeamCache.state }).from(ftcTeamCache).where(eq(ftcTeamCache.number, team.number)).limit(1),
    db.select({ members: sql<number>`count(*)::int` }).from(sponsorMembers).where(eq(sponsorMembers.sponsorId, company.id)),
    queueNeighbours(pitch.id),
  ])

  const deckUrl = publicUrl(team.pdfPath)
  return {
    id: pitch.id,
    status: pitch.status,
    submittedAt: pitch.submittedAt,
    reviewNote: pitch.reviewNote,
    reviewedByName: row.reviewer,
    reviewedAt: pitch.reviewedAt,
    resubmission: Boolean(row.resubmission),
    view: {
      team: teamForView(team),
      company: { id: company.id, name: company.name, logoUrl: publicUrl(company.logoPath) },
      answers: pitch.answers,
      ask: { type: pitch.askType, amountCents: pitch.askAmountCents, note: pitch.askNote, label: formatAsk({ type: pitch.askType, amountCents: pitch.askAmountCents, note: pitch.askNote }) },
      submittedAt: pitch.submittedAt,
    },
    deck: deckUrl && team.pdfPages ? { url: deckUrl, downloadUrl: `${deckUrl}?download=${encodeURIComponent(`Team ${team.number} sponsorship deck.pdf`)}`, pages: team.pdfPages, thumbUrl: publicUrl(team.pdfThumbPath) } : null,
    team: {
      id: team.id,
      number: team.number,
      name: team.name,
      verified: Boolean(team.verifiedAt),
      suspended: Boolean(team.suspendedAt),
      createdAt: team.createdAt,
      recordStatus: team.recordStatus,
      record: record ?? null,
      members: members.map((m) => ({ name: m.name.trim() || m.email, email: m.email })),
      otherPitches: others,
    },
    company: {
      id: company.id,
      name: company.name,
      website: company.website,
      logoUrl: publicUrl(company.logoPath),
      status: company.status,
      memberCount: Number(companyCounts?.members ?? 0),
      questionCount: company.questions.length,
    },
    approvalBlocker: approvalBlocker({ number: team.number, suspended: Boolean(team.suspendedAt) }, company),
    queue: neighbours,
  }
}

/** Where this pitch sits in the in-review queue (oldest first), and its neighbours. */
async function queueNeighbours(pitchId: string) {
  const [row] = await getDb().execute<{ total: number; position: number | null; previous_id: string | null; next_id: string | null }>(sql`
    with queue as (
      select id, row_number() over (order by submitted_at asc, id asc) as n
      from ${pitches} where status = 'in_review'
    ), me as (
      select coalesce((select n from queue where id = ${pitchId}),
        (select count(*) from ${pitches} where status = 'in_review' and (submitted_at, id) < ((select p.submitted_at from ${pitches} p where p.id = ${pitchId}), ${pitchId}::uuid))) as n,
        exists (select 1 from queue where id = ${pitchId}) as inside
    )
    select
      (select count(*)::int from queue) as total,
      (select case when inside then n::int else null end from me) as position,
      (select q.id from queue q, me where q.n = case when me.inside then me.n - 1 else me.n end) as previous_id,
      (select q.id from queue q, me where q.n = me.n + 1) as next_id
  `)
  return { total: Number(row.total), position: row.position === null ? null : Number(row.position), previousId: row.previous_id, nextId: row.next_id }
}

/** The pitch an admin should see after deciding `pitchId`: the next one in the queue, wrapping. */
export async function nextInQueue(pitchId: string) {
  const [row] = await getDb().execute<{ id: string | null }>(sql`
    select coalesce(
      (select id from ${pitches} where status = 'in_review' and id <> ${pitchId}
        and (submitted_at, id) > ((select p.submitted_at from ${pitches} p where p.id = ${pitchId}), ${pitchId}::uuid)
        order by submitted_at asc, id asc limit 1),
      (select id from ${pitches} where status = 'in_review' and id <> ${pitchId} order by submitted_at asc, id asc limit 1)
    ) as id
  `)
  return row?.id ?? null
}

// ─── Decisions ──────────────────────────────────────────────────────────────────────────

const DECIDED_VERB: Partial<Record<PitchStatus, string>> = {
  sent: 'approved',
  matched: 'approved',
  declined: 'approved',
  changes_requested: 'sent back',
  rejected: 'rejected',
}

async function lockForDecision(pitchId: string) {
  const db = getDb()
  const [row] = await db
    .select({
      pitch: pitches,
      reviewer: sql<string | null>`(select coalesce(nullif(u.name, ''), u.email) from ${users} u where u.id = "pitches"."reviewed_by")`,
      team: { id: teams.id, number: teams.number, name: teams.name, city: teams.city, state: teams.state, summary: teams.summary, suspendedAt: teams.suspendedAt, verifiedAt: teams.verifiedAt },
      company: { id: sponsors.id, name: sponsors.name, status: sponsors.status },
    })
    .from(pitches)
    .innerJoin(teams, eq(teams.id, pitches.teamId))
    .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
    .where(eq(pitches.id, pitchId))
    .for('update', { of: pitches })
  if (!row) throw new AppError('NOT_FOUND', "That pitch doesn't exist anymore.")
  if (row.pitch.status !== 'in_review') {
    const verb = DECIDED_VERB[row.pitch.status]
    const who = row.reviewer ?? 'Another admin'
    const message =
      row.pitch.status === 'withdrawn'
        ? `Team ${row.team.number} withdrew this pitch.`
        : row.pitch.status === 'draft'
          ? 'This pitch isn’t submitted anymore.'
          : `${who} already ${verb} this pitch.`
    throw new AppError('CONFLICT', message)
  }
  return row
}

async function submitter(pitch: { teamId: string; submittedBy: string | null; createdBy: string | null }) {
  const ids = [pitch.submittedBy, pitch.createdBy].filter((v): v is string => Boolean(v))
  if (ids.length) {
    const rows = await getDb().select({ id: users.id, email: users.email, name: users.name }).from(users).where(and(inArray(users.id, ids), isNull(users.suspendedAt)))
    const found = ids.map((id) => rows.find((r) => r.id === id)).find(Boolean)
    if (found) return found
  }
  const [member] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, pitch.teamId))
    .orderBy(asc(teamMembers.createdAt))
    .limit(1)
  return member ?? null
}

type DecisionUpdate = Partial<typeof pitches.$inferInsert>

async function decide(admin: Viewer, pitchId: string, patch: DecisionUpdate, action: string, data: Record<string, unknown>, now: Date) {
  const locked = await lockForDecision(pitchId)
  if (patch.status === 'sent') {
    const blocker = approvalBlocker({ number: locked.team.number, suspended: Boolean(locked.team.suspendedAt) }, locked.company)
    if (blocker) throw new AppError('CONFLICT', blocker)
  }
  const [row] = await getDb()
    .update(pitches)
    .set({ ...patch, reviewedBy: admin.id, reviewedAt: now, updatedAt: now })
    .where(and(eq(pitches.id, pitchId), eq(pitches.status, 'in_review')))
    .returning()
  if (!row) throw new AppError('CONFLICT', 'Another admin already decided this pitch.')
  await audit({ actorId: admin.id, action, entityType: 'pitch', entityId: pitchId, data })
  const coach = await submitter(row)
  return { pitch: row, team: locked.team, company: locked.company, coach }
}

export async function approvePitch(admin: Viewer, pitchId: string, now = new Date()) {
  const result = await decide(admin, pitchId, { status: 'sent', sentAt: now, reviewNote: null }, 'pitch.approved', {}, now)
  const members = await companyRecipients(result.company.id)
  return { ...result, members }
}

export async function sendBackPitch(admin: Viewer, pitchId: string, note: string, now = new Date()) {
  return decide(admin, pitchId, { status: 'changes_requested', reviewNote: note }, 'pitch.sent_back', { note }, now)
}

export async function rejectPitch(admin: Viewer, pitchId: string, note: string | null, now = new Date()) {
  return decide(admin, pitchId, { status: 'rejected', reviewNote: note }, 'pitch.rejected', note ? { note } : {}, now)
}
