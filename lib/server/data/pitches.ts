import 'server-only'

import { and, asc, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm'

import type { Tone } from '@/lib/shared/labels'
import {
  EDITABLE_STATUSES,
  formatAsk,
  submitBlockers,
  WITHDRAWABLE_STATUSES,
  type Ask,
  type AskType,
  type PitchViewData,
} from '@/lib/shared/pitch'
import { questionsFor, type Question } from '@/lib/shared/questions'
import { pitchSeason } from '@/lib/shared/season'
import type { PitchStatus } from '@/lib/shared/types'

import type { TeamViewer } from '../authz'
import { audit } from '../audit'
import { getDb } from '../db'
import { AppError, isUniqueViolation } from '../result'
import { auditEvents, emailOutbox, pitches, sponsorMembers, sponsors, teams, users, type ContactSnapshot, type PitchAnswer } from '../schema'
import { publicUrl } from '../storage'

/*
 * Coach-side pitches (plan §3.2 "Pitch composer", §3.3 lifecycle). Transitions are
 * `UPDATE … WHERE status IN (allowed) RETURNING`; zero rows is a CONFLICT with a human message.
 * The season rule lives in the database (pitches_one_per_season_key).
 *
 * Email ↔ pitch convention (prompt 3 follows it): every email about a pitch uses the dedupe key
 * `pitch:{pitchId}:{template}:{recipient}[:{suffix}]`, so the timeline can show delivery state.
 */

const NOT_FOUND = "That pitch doesn't exist or isn't your team's."

export const pitchEmailKey = (pitchId: string, template: string, recipient: string, suffix?: string | number) =>
  ['pitch', pitchId, template, recipient, ...(suffix !== undefined ? [String(suffix)] : [])].join(':')

// ─── Shared shapes ──────────────────────────────────────────────────────────────────────

export type { PitchViewData }

type TeamRow = Pick<typeof teams.$inferSelect, 'number' | 'name' | 'location' | 'summary' | 'website' | 'instagram' | 'logoPath' | 'status' | 'pdfPath' | 'pdfThumbPath' | 'pdfPages'>

export function teamForView(row: TeamRow): PitchViewData['team'] {
  const deckUrl = publicUrl(row.pdfPath)
  return {
    number: row.number,
    name: row.name,
    location: row.location,
    summary: row.summary,
    website: row.website,
    instagram: row.instagram,
    logoUrl: publicUrl(row.logoPath),
    verified: row.status === 'approved',
    deck: deckUrl && row.pdfPages ? { url: deckUrl, thumbUrl: publicUrl(row.pdfThumbPath), pages: row.pdfPages } : null,
  }
}

const teamColumns = {
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
}

function askOf(row: { askType: AskType; askAmountCents: number | null; askNote: string | null }): PitchViewData['ask'] {
  const ask = { type: row.askType, amountCents: row.askAmountCents, note: row.askNote }
  return { ...ask, label: formatAsk(ask) }
}

// ─── Composer ───────────────────────────────────────────────────────────────────────────

async function currentSeasonPitch(teamId: string, sponsorId: string, now: Date) {
  const [row] = await getDb()
    .select({ id: pitches.id, status: pitches.status, answers: pitches.answers, askType: pitches.askType, askAmountCents: pitches.askAmountCents, askNote: pitches.askNote, reviewNote: pitches.reviewNote, updatedAt: pitches.updatedAt })
    .from(pitches)
    .where(and(eq(pitches.teamId, teamId), eq(pitches.sponsorId, sponsorId), eq(pitches.season, pitchSeason(now)), sql`${pitches.status} <> 'withdrawn'`))
    .limit(1)
  return row ?? null
}

async function editableSponsor(sponsorId: string) {
  const [row] = await getDb()
    .select({ id: sponsors.id, name: sponsors.name, status: sponsors.status, questions: sponsors.questions })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1)
  if (!row || row.status !== 'approved') throw new AppError('NOT_FOUND', "That company isn't on FTC Pitfund, or isn't accepting pitches right now.")
  return { ...row, questions: questionsFor(row) }
}

function seasonConflict(company: string, pitchId: string) {
  return new AppError('CONFLICT', `You've already pitched ${company} this season.`, { href: `/pitches/${pitchId}` })
}

/** The composer's data: team readiness plus this season's editable pitch, if one exists. */
export async function getComposerState(viewer: TeamViewer, sponsorId: string, now = new Date()) {
  const [teamRows, pitch] = await Promise.all([
    getDb().select(teamColumns).from(teams).where(eq(teams.id, viewer.team.id)).limit(1),
    currentSeasonPitch(viewer.team.id, sponsorId, now),
  ])
  const team = teamRows[0]
  if (!team) throw new AppError('NOT_FOUND', NOT_FOUND)
  return { team: teamForView(team), pitch }
}

/** "Start pitch": reuse this season's draft, or create one. A sent pitch is a season conflict. */
export async function startPitch(viewer: TeamViewer, sponsorId: string, now = new Date()) {
  const company = await editableSponsor(sponsorId)
  const existing = await currentSeasonPitch(viewer.team.id, sponsorId, now)
  if (existing) {
    if (EDITABLE_STATUSES.includes(existing.status)) return { pitchId: existing.id, created: false }
    throw seasonConflict(company.name, existing.id)
  }
  const blank = company.questions.map((q) => ({ questionId: q.id, prompt: q.prompt, answer: '' }))
  // A savepoint, so losing a race to a teammate's draft doesn't abort the caller's transaction.
  const inserted = await getDb()
    .transaction(async (tx) =>
      tx
        .insert(pitches)
        .values({ teamId: viewer.team.id, sponsorId, season: pitchSeason(now), status: 'draft', answers: blank, createdBy: viewer.id })
        .returning({ id: pitches.id }),
    )
    .catch((e: unknown) => {
      if (isUniqueViolation(e, 'pitches_one_per_season_key')) return null
      throw e
    })
  if (!inserted) {
    const raced = await currentSeasonPitch(viewer.team.id, sponsorId, now)
    if (raced && EDITABLE_STATUSES.includes(raced.status)) return { pitchId: raced.id, created: false }
    throw seasonConflict(company.name, raced?.id ?? '')
  }
  await audit({ actorId: viewer.id, action: 'pitch.created', entityType: 'pitch', entityId: inserted[0].id, data: { sponsorId } })
  return { pitchId: inserted[0].id, created: true }
}

function answersFor(questions: Question[], input: Array<{ questionId: string; answer: string }>): PitchAnswer[] {
  const byId = new Map(input.map((a) => [a.questionId, a.answer]))
  return questions.map((q) => ({ questionId: q.id, prompt: q.prompt, answer: byId.get(q.id) ?? '' }))
}

function askColumns(ask: Ask) {
  return {
    askType: ask.type,
    askAmountCents: ask.type === 'amount' && ask.amountDollars ? ask.amountDollars * 100 : null,
    askNote: ask.type === 'in_kind' || ask.type === 'open' ? ask.note : null,
  }
}

async function explainNotEditable(viewer: TeamViewer, pitchId: string): Promise<never> {
  const [row] = await getDb()
    .select({ status: pitches.status })
    .from(pitches)
    .where(and(eq(pitches.id, pitchId), eq(pitches.teamId, viewer.team.id)))
  if (!row) throw new AppError('NOT_FOUND', NOT_FOUND)
  if (row.status === 'withdrawn') throw new AppError('CONFLICT', 'This pitch was withdrawn, so it can’t be edited.', { href: `/pitches/${pitchId}` })
  throw new AppError('CONFLICT', 'This pitch was already submitted, so it can’t be edited.', { href: `/pitches/${pitchId}` })
}

/** Autosave. Creates the draft on the first save when the composer was opened directly. */
export async function saveDraft(
  viewer: TeamViewer,
  input: { sponsorId: string; pitchId: string | null; answers: Array<{ questionId: string; answer: string }>; ask: Ask },
  now = new Date(),
) {
  const company = await editableSponsor(input.sponsorId)
  const pitchId = input.pitchId ?? (await startPitch(viewer, input.sponsorId, now)).pitchId
  const [row] = await getDb()
    .update(pitches)
    .set({ answers: answersFor(company.questions, input.answers), ...askColumns(input.ask), updatedAt: now })
    .where(and(eq(pitches.id, pitchId), eq(pitches.teamId, viewer.team.id), eq(pitches.sponsorId, input.sponsorId), inArray(pitches.status, EDITABLE_STATUSES)))
    .returning({ id: pitches.id, updatedAt: pitches.updatedAt })
  if (!row) return explainNotEditable(viewer, pitchId)
  return { pitchId: row.id, savedAt: row.updatedAt }
}

/** Submit (or resubmit after "Send back"). Saves the final content in the same statement. */
export async function submitPitch(
  viewer: TeamViewer,
  input: { pitchId: string; answers: Array<{ questionId: string; answer: string }>; ask: Ask },
  now = new Date(),
) {
  const db = getDb()
  const [current] = await db
    .select({ id: pitches.id, status: pitches.status, sponsorId: pitches.sponsorId, season: pitches.season })
    .from(pitches)
    .where(and(eq(pitches.id, input.pitchId), eq(pitches.teamId, viewer.team.id)))
    .for('update')
  if (!current) throw new AppError('NOT_FOUND', NOT_FOUND)
  if (!EDITABLE_STATUSES.includes(current.status)) return explainNotEditable(viewer, input.pitchId)

  const company = await editableSponsor(current.sponsorId)
  const [team] = await db.select(teamColumns).from(teams).where(eq(teams.id, viewer.team.id))
  const answers = answersFor(company.questions, input.answers)
  const blockers = submitBlockers({ hasDeck: Boolean(team?.pdfPath), hasSummary: Boolean(team?.summary?.trim()), questions: company.questions, answers, ask: input.ask })
  if (blockers.length > 0) {
    const first = blockers[0]
    const fieldErrors = Object.fromEntries(
      blockers.filter((b) => b.questionId).map((b) => [`answers.${b.questionId}`, 'Answer this question to submit']),
    )
    throw new AppError('VALIDATION', first.questionId ? 'Answer this question to submit' : first.message, {
      field: first.questionId ? `answers.${first.questionId}` : first.key,
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
      href: first.href,
    })
  }

  const resubmission = current.status === 'changes_requested'
  const season = resubmission ? current.season : pitchSeason(now)
  const [row] = await db
    .update(pitches)
    .set({ status: 'in_review', season, answers, ...askColumns(input.ask), submittedBy: viewer.id, submittedAt: now, updatedAt: now })
    .where(and(eq(pitches.id, input.pitchId), eq(pitches.teamId, viewer.team.id), inArray(pitches.status, EDITABLE_STATUSES)))
    .returning()
  if (!row) return explainNotEditable(viewer, input.pitchId)

  await audit({ actorId: viewer.id, action: 'pitch.submitted', entityType: 'pitch', entityId: row.id, data: { resubmission } })
  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.isAdmin, true), isNull(users.suspendedAt)))
  return {
    pitch: row,
    company: { id: company.id, name: company.name },
    team: team ? teamForView(team) : null,
    admins,
    resubmission,
  }
}

export const SUBMIT_CONFLICTS = { pitches_one_per_season_key: 'You’ve already pitched this company this season.' }

export async function withdrawPitch(viewer: TeamViewer, pitchId: string, now = new Date()) {
  const db = getDb()
  const [current] = await db
    .select({ id: pitches.id, status: pitches.status, sponsorId: pitches.sponsorId })
    .from(pitches)
    .where(and(eq(pitches.id, pitchId), eq(pitches.teamId, viewer.team.id)))
    .for('update')
  if (!current) throw new AppError('NOT_FOUND', NOT_FOUND)
  const [row] = await db
    .update(pitches)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(and(eq(pitches.id, pitchId), eq(pitches.teamId, viewer.team.id), inArray(pitches.status, WITHDRAWABLE_STATUSES)))
    .returning({ id: pitches.id, sponsorId: pitches.sponsorId })
  if (!row) {
    const message =
      current.status === 'withdrawn'
        ? 'This pitch was already withdrawn.'
        : current.status === 'draft'
          ? 'A draft can’t be withdrawn. Delete it instead.'
          : 'This pitch already has an answer, so it can’t be withdrawn.'
    throw new AppError('CONFLICT', message)
  }
  const wasSent = current.status === 'sent'
  await audit({ actorId: viewer.id, action: 'pitch.withdrawn', entityType: 'pitch', entityId: row.id, data: { from: current.status } })
  const [company] = await db.select({ name: sponsors.name }).from(sponsors).where(eq(sponsors.id, row.sponsorId))
  const members = wasSent
    ? await db
        .select({ id: users.id, email: users.email })
        .from(sponsorMembers)
        .innerJoin(users, eq(users.id, sponsorMembers.userId))
        .where(and(eq(sponsorMembers.sponsorId, row.sponsorId), isNull(users.suspendedAt)))
    : []
  return { pitchId: row.id, sponsorId: row.sponsorId, companyName: company?.name ?? 'the company', wasSent, members }
}

export async function deleteDraft(viewer: TeamViewer, pitchId: string) {
  const [row] = await getDb()
    .delete(pitches)
    .where(and(eq(pitches.id, pitchId), eq(pitches.teamId, viewer.team.id), eq(pitches.status, 'draft')))
    .returning({ id: pitches.id, sponsorId: pitches.sponsorId })
  if (!row) {
    const [exists] = await getDb().select({ status: pitches.status }).from(pitches).where(and(eq(pitches.id, pitchId), eq(pitches.teamId, viewer.team.id)))
    if (!exists) throw new AppError('NOT_FOUND', NOT_FOUND)
    throw new AppError('CONFLICT', 'Only a draft can be deleted. This pitch was already submitted.')
  }
  await audit({ actorId: viewer.id, action: 'pitch.draft_deleted', entityType: 'pitch', entityId: row.id, data: { sponsorId: row.sponsorId } })
  return row
}

// ─── Reading ────────────────────────────────────────────────────────────────────────────

export type TeamPitchRow = {
  id: string
  status: PitchStatus
  sponsorId: string
  companyName: string
  companyLogoUrl: string | null
  lastAction: string | null
  lastAt: Date
}

/** /pitches: one query, newest activity first. */
export async function listTeamPitches(viewer: TeamViewer): Promise<TeamPitchRow[]> {
  const last = sql<{ action: string; at: string } | null>`(
    select json_build_object('action', e.action, 'at', e.created_at)
    from ${auditEvents} e
    where e.entity_type = 'pitch' and e.entity_id = ${pitches.id}
    order by e.created_at desc limit 1
  )`
  const rows = await getDb()
    .select({
      id: pitches.id,
      status: pitches.status,
      sponsorId: pitches.sponsorId,
      companyName: sponsors.name,
      companyLogo: sponsors.logoPath,
      updatedAt: pitches.updatedAt,
      last,
    })
    .from(pitches)
    .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
    .where(eq(pitches.teamId, viewer.team.id))
    .orderBy(desc(pitches.updatedAt))
  return rows
    .map((r) => ({
      id: r.id,
      status: r.status,
      sponsorId: r.sponsorId,
      companyName: r.companyName,
      companyLogoUrl: publicUrl(r.companyLogo),
      lastAction: r.last?.action ?? null,
      lastAt: r.last ? new Date(r.last.at) : r.updatedAt,
    }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
}

export const EVENT_VERBS: Record<string, string> = {
  'pitch.created': 'Draft started',
  'pitch.submitted': 'Submitted',
  'pitch.sent_back': 'Sent back',
  'pitch.rejected': 'Not approved',
  'pitch.approved': 'Approved and sent',
  'pitch.matched': 'Matched',
  'pitch.declined': 'Marked not a fit',
  'pitch.withdrawn': 'Withdrawn',
}

export type PitchTimelineEvent = { id: string; title: string; description: string | null; note: string | null; tone: Tone; at: Date }

export type TeamPitchDetail = {
  id: string
  status: PitchStatus
  season: number
  reviewNote: string | null
  declineReason: string | null
  view: PitchViewData
  timeline: PitchTimelineEvent[]
  /** Only for matched pitches (plan §5 "Security"). */
  contact: ContactSnapshot | null
}

type EmailRow = { template: string; status: string; sendAfter: Date }

function deliveryNote(rows: EmailRow[], template: string, company: string, now: Date): string | null {
  const mine = rows.filter((r) => r.template === template)
  if (mine.length === 0) return null
  if (mine.some((r) => r.status === 'failed' || r.status === 'bounced')) {
    return `Email to ${company} couldn’t be delivered; they can still see it in FTC Pitfund.`
  }
  if (mine.some((r) => (r.status === 'queued' || r.status === 'sending') && r.sendAfter.getTime() > now.getTime() + 5 * 60 * 1000)) {
    return `Email to ${company} delayed until tomorrow; they can see it in FTC Pitfund.`
  }
  return null
}

export function buildTimeline(
  events: Array<{ id: string; action: string; data: Record<string, unknown>; createdAt: Date }>,
  context: { company: string; declineReason: string | null; emails: EmailRow[]; now?: Date },
): PitchTimelineEvent[] {
  const now = context.now ?? new Date()
  const note = (data: Record<string, unknown>) => (typeof data.note === 'string' && data.note.trim() ? data.note : null)
  const out: PitchTimelineEvent[] = []
  for (const e of events) {
    const base = { id: e.id, at: e.createdAt, description: null as string | null, note: null as string | null }
    switch (e.action) {
      case 'pitch.created':
        out.push({ ...base, title: 'Created', tone: 'neutral' })
        break
      case 'pitch.submitted':
        out.push({ ...base, title: e.data.resubmission ? 'Resubmitted for review' : 'Submitted for review', tone: 'info' })
        break
      case 'pitch.sent_back':
        out.push({ ...base, title: 'Sent back with a note', note: note(e.data), tone: 'warning' })
        break
      case 'pitch.rejected':
        out.push({ ...base, title: 'Not approved', note: note(e.data), tone: 'danger' })
        break
      case 'pitch.approved':
        out.push({ ...base, title: `Approved and sent to ${context.company}`, description: deliveryNote(context.emails, 'new-pitch-sponsor', context.company, now), tone: 'accent' })
        break
      case 'pitch.matched':
        out.push({ ...base, title: `Matched: ${context.company} is interested`, tone: 'success' })
        break
      case 'pitch.declined': {
        const reason = (typeof e.data.reason === 'string' && e.data.reason) || context.declineReason
        out.push({ ...base, title: `${context.company} marked it not a fit`, note: reason || null, tone: 'neutral' })
        break
      }
      case 'pitch.withdrawn':
        out.push({
          ...base,
          title: 'Withdrawn',
          description: e.data.from === 'sent' ? deliveryNote(context.emails, 'pitch-withdrawn', context.company, now) : null,
          tone: 'neutral',
        })
        break
    }
  }
  return out
}

export async function getTeamPitch(viewer: TeamViewer, pitchId: string, now = new Date()): Promise<TeamPitchDetail> {
  const db = getDb()
  const [rows, events, emails] = await Promise.all([
    db
      .select({ pitch: pitches, team: teamColumns, company: { id: sponsors.id, name: sponsors.name, logoPath: sponsors.logoPath } })
      .from(pitches)
      .innerJoin(teams, eq(teams.id, pitches.teamId))
      .innerJoin(sponsors, eq(sponsors.id, pitches.sponsorId))
      .where(and(eq(pitches.id, pitchId), eq(pitches.teamId, viewer.team.id)))
      .limit(1),
    db
      .select({ id: auditEvents.id, action: auditEvents.action, data: auditEvents.data, createdAt: auditEvents.createdAt })
      .from(auditEvents)
      .where(and(eq(auditEvents.entityType, 'pitch'), eq(auditEvents.entityId, pitchId)))
      .orderBy(asc(auditEvents.createdAt)),
    db
      .select({ template: emailOutbox.template, status: emailOutbox.status, sendAfter: emailOutbox.sendAfter })
      .from(emailOutbox)
      .where(like(emailOutbox.dedupeKey, `pitch:${pitchId}:%`)),
  ])
  const row = rows[0]
  if (!row) throw new AppError('NOT_FOUND', NOT_FOUND)
  const { pitch, team, company } = row
  return {
    id: pitch.id,
    status: pitch.status,
    season: pitch.season,
    reviewNote: pitch.reviewNote,
    declineReason: pitch.declineReason,
    view: {
      team: teamForView(team),
      company: { id: company.id, name: company.name, logoUrl: publicUrl(company.logoPath) },
      answers: pitch.answers,
      ask: askOf(pitch),
      submittedAt: pitch.submittedAt,
    },
    timeline: buildTimeline(events, { company: company.name, declineReason: pitch.declineReason, emails, now }),
    contact: pitch.status === 'matched' ? pitch.sponsorContact : null,
  }
}
