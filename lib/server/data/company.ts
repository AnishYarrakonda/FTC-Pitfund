import 'server-only'

import { and, asc, count, eq, ne, sql } from 'drizzle-orm'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { questionsFor, type Question } from '@/lib/shared/questions'
import type { OrgRole, SupportType } from '@/lib/shared/types'
import type { Viewer } from '@/lib/shared/viewer'

import type { SponsorViewer } from '../authz'
import { audit } from '../audit'
import { getDb } from '../db'
import { AppError } from '../result'
import { auditEvents, sponsorMembers, sponsors, users, type Sponsor } from '../schema'
import { publicUrl } from '../storage'
import { assertOwnStagingPath, createStagingUpload, discard, publishVerified, readStaged, verifyImageBytes } from '../uploads'

/*
 * Companies (sponsors): first-run creation, the profile and questions editor, logo, and members
 * (prompt 3, scope A and B). A company is created `pending`: it can set itself up but is invisible
 * to coaches until an admin approves it (lib/server/data/directory.ts only ever reads `approved`).
 */

// ─── First run ──────────────────────────────────────────────────────────────────────────

export type CreateCompanyData = { name: string; website: string; yourName: string; jobTitle: string; linkedin: string | null }

export async function createCompany(viewer: Viewer, input: CreateCompanyData) {
  if (viewer.team || viewer.sponsor) throw new AppError('CONFLICT', 'You’re already part of a team or company.')
  if (viewer.pendingJoin) {
    throw new AppError('CONFLICT', `Cancel your request to join Team ${viewer.pendingJoin.teamNumber} first.`)
  }
  const db = getDb()
  const [company] = await db
    .insert(sponsors)
    .values({ name: input.name, website: input.website, status: 'pending', applicantTitle: input.jobTitle, applicantLinkedin: input.linkedin })
    .returning({ id: sponsors.id, name: sponsors.name })
  // Whoever creates the company owns it. Everyone invited later is an editor.
  await db.insert(sponsorMembers).values({ sponsorId: company.id, userId: viewer.id, role: 'owner' })
  await db
    .update(users)
    .set({ name: input.yourName, jobTitle: input.jobTitle, acceptedTermsAt: sql`coalesce(${users.acceptedTermsAt}, now())` })
    .where(eq(users.id, viewer.id))
  await audit({ actorId: viewer.id, action: 'sponsor.created', entityType: 'sponsor', entityId: company.id, data: { name: company.name } })
  return company
}

export const CREATE_COMPANY_CONFLICTS = {
  sponsor_members_user_key: 'You’re already part of a company.',
}

// ─── Profile ────────────────────────────────────────────────────────────────────────────

export type CompanyProfile = {
  id: string
  name: string
  website: string
  logoUrl: string | null
  city: string | null
  state: string | null
  region: string | null
  about: string | null
  supportTypes: SupportType[]
  status: Sponsor['status']
  statusNote: string | null
  /** The company's own questions (empty = the defaults apply). */
  customQuestions: Question[]
  /** What teams answer: the custom questions, or the defaults with the name filled in. */
  questions: Question[]
  usesDefaultQuestions: boolean
  reviewedQuestions: boolean
  createdAt: Date
}

const QUESTION_ACTIONS = ['sponsor.questions_saved', 'sponsor.questions_reset', 'sponsor.questions_confirmed']

function toProfile(row: Sponsor, reviewedQuestions: boolean): CompanyProfile {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    logoUrl: publicUrl(row.logoPath),
    city: row.city,
    state: row.state,
    region: row.region,
    about: row.about,
    supportTypes: row.supportTypes,
    status: row.status,
    statusNote: row.statusNote,
    customQuestions: row.questions,
    questions: questionsFor(row),
    usesDefaultQuestions: row.questions.length === 0,
    reviewedQuestions: reviewedQuestions || row.questions.length > 0,
    createdAt: row.createdAt,
  }
}

const reviewedQuestionsSql = sql<boolean>`exists (
  select 1 from ${auditEvents} e
  where e.entity_type = 'sponsor' and e.entity_id = "sponsors"."id"
    and e.action in (${sql.join(QUESTION_ACTIONS.map((a) => sql`${a}`), sql`, `)})
)`

/** The viewer's own company, in any status (a pending company still sees and edits itself). */
export async function getCompanyProfile(viewer: SponsorViewer): Promise<CompanyProfile> {
  const [row] = await getDb()
    .select({ sponsor: sponsors, reviewed: reviewedQuestionsSql })
    .from(sponsors)
    .where(eq(sponsors.id, viewer.sponsor.id))
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND', "That company doesn't exist or you're not part of it.")
  return toProfile(row.sponsor, Boolean(row.reviewed))
}

export async function updateCompanyProfile(
  viewer: SponsorViewer,
  input: { name: string; website: string; city: string | null; state: string | null; region: string | null; about: string | null; supportTypes: SupportType[] },
) {
  const [row] = await getDb().update(sponsors).set(input).where(eq(sponsors.id, viewer.sponsor.id)).returning()
  if (!row) throw new AppError('NOT_FOUND', "That company doesn't exist or you're not part of it.")
  await audit({ actorId: viewer.id, action: 'sponsor.profile_updated', entityType: 'sponsor', entityId: row.id, data: { fields: Object.keys(input) } })
  return toProfile(row, true)
}

/** Replace the question list (0–10). Pitches already submitted keep the questions they answered. */
export async function saveCompanyQuestions(viewer: SponsorViewer, questions: Question[]) {
  if (questions.length > 10) throw new AppError('VALIDATION', 'A company can ask up to 10 questions.')
  const clean = questions.map((q) => ({ id: q.id, prompt: q.prompt.trim(), ...(q.help?.trim() ? { help: q.help.trim() } : {}), required: q.required }))
  const [row] = await getDb().update(sponsors).set({ questions: clean }).where(eq(sponsors.id, viewer.sponsor.id)).returning()
  if (!row) throw new AppError('NOT_FOUND', "That company doesn't exist or you're not part of it.")
  await audit({
    actorId: viewer.id,
    action: clean.length === 0 ? 'sponsor.questions_reset' : 'sponsor.questions_saved',
    entityType: 'sponsor',
    entityId: row.id,
    data: { count: clean.length },
  })
  return toProfile(row, true)
}

/** "Use these questions": the company reviewed the defaults and keeps them. */
export async function confirmDefaultQuestions(viewer: SponsorViewer) {
  await audit({ actorId: viewer.id, action: 'sponsor.questions_confirmed', entityType: 'sponsor', entityId: viewer.sponsor.id })
  return getCompanyProfile(viewer)
}

// ─── Logo ───────────────────────────────────────────────────────────────────────────────

const sponsorPrefix = (sponsorId: string) => `sponsors/${sponsorId}`

export async function createCompanyUpload(viewer: SponsorViewer, imageExt: 'webp' | 'jpg') {
  return createStagingUpload(sponsorPrefix(viewer.sponsor.id), imageExt)
}

export async function finalizeCompanyLogo(viewer: SponsorViewer, stagingPath: string) {
  const prefix = sponsorPrefix(viewer.sponsor.id)
  assertOwnStagingPath(stagingPath, prefix)
  const bytes = await readStaged(stagingPath)
  const kind = verifyImageBytes(bytes, 'logo')
  const [before] = await getDb().select({ logoPath: sponsors.logoPath }).from(sponsors).where(eq(sponsors.id, viewer.sponsor.id))
  const logoPath = await publishVerified(prefix, 'logo', bytes, kind)
  await discard('staging', [stagingPath])
  const [row] = await getDb().update(sponsors).set({ logoPath, logoBytes: bytes.byteLength }).where(eq(sponsors.id, viewer.sponsor.id)).returning()
  await audit({ actorId: viewer.id, action: 'sponsor.logo_updated', entityType: 'sponsor', entityId: viewer.sponsor.id })
  return { profile: toProfile(row, true), replaced: [before?.logoPath] }
}

// ─── Members ────────────────────────────────────────────────────────────────────────────

export type CompanyMemberRow = { userId: string; name: string; email: string; jobTitle: string | null; avatarUrl: string | null; role: OrgRole; joinedAt: Date }

export async function listCompanyMembers(viewer: SponsorViewer): Promise<CompanyMemberRow[]> {
  return getDb()
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      jobTitle: users.jobTitle,
      avatarUrl: users.avatarUrl,
      role: sponsorMembers.role,
      joinedAt: sponsorMembers.createdAt,
    })
    .from(sponsorMembers)
    .innerJoin(users, eq(users.id, sponsorMembers.userId))
    .where(eq(sponsorMembers.sponsorId, viewer.sponsor.id))
    .orderBy(asc(sql`case when ${sponsorMembers.role} = 'owner' then 0 else 1 end`), asc(sponsorMembers.createdAt))
}

async function lockCompany(sponsorId: string) {
  await getDb().execute(sql`select 1 from ${sponsors} where ${sponsors.id} = ${sponsorId} for update`)
}

async function memberCount(sponsorId: string, exceptUserId?: string) {
  const [row] = await getDb()
    .select({ n: count() })
    .from(sponsorMembers)
    .where(and(eq(sponsorMembers.sponsorId, sponsorId), exceptUserId ? ne(sponsorMembers.userId, exceptUserId) : undefined))
  return Number(row?.n ?? 0)
}

export async function removeCompanyMember(viewer: SponsorViewer, userId: string) {
  if (userId === viewer.id) throw new AppError('VALIDATION', 'To leave the company yourself, use Leave company.')
  await lockCompany(viewer.sponsor.id)
  const rows = await getDb()
    .delete(sponsorMembers)
    .where(and(eq(sponsorMembers.sponsorId, viewer.sponsor.id), eq(sponsorMembers.userId, userId), ne(sponsorMembers.role, 'owner')))
    .returning({ userId: sponsorMembers.userId })
  if (!rows[0]) throw new AppError('NOT_FOUND', 'That person isn’t part of your company anymore.')
  const [person] = await getDb().select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId))
  await audit({ actorId: viewer.id, action: 'sponsor.member_removed', entityType: 'sponsor', entityId: viewer.sponsor.id, data: { userId } })
  return { userId, name: person?.name || person?.email || 'That person' }
}

export async function leaveCompany(viewer: SponsorViewer) {
  await lockCompany(viewer.sponsor.id)
  if (viewer.sponsor.role === 'owner') {
    const others = await memberCount(viewer.sponsor.id, viewer.id)
    throw new AppError(
      'CONFLICT',
      others === 0
        ? `You own ${viewer.sponsor.name} and you’re its only member. Invite a coworker and make them the owner first, or email ${SUPPORT_EMAIL} to close the company.`
        : `You own ${viewer.sponsor.name}. Make a coworker the owner before you leave.`,
    )
  }
  await getDb().delete(sponsorMembers).where(and(eq(sponsorMembers.sponsorId, viewer.sponsor.id), eq(sponsorMembers.userId, viewer.id)))
  await audit({ actorId: viewer.id, action: 'sponsor.member_left', entityType: 'sponsor', entityId: viewer.sponsor.id, data: { userId: viewer.id } })
  return { sponsorId: viewer.sponsor.id }
}

/** See transferTeamOwnership: demote then promote, so the one-owner index is never violated. */
export async function transferCompanyOwnership(viewer: SponsorViewer, userId: string) {
  if (userId === viewer.id) throw new AppError('VALIDATION', 'You already own this company.')
  const db = getDb()
  await lockCompany(viewer.sponsor.id)
  const [target] = await db
    .select({ userId: sponsorMembers.userId, name: users.name, email: users.email })
    .from(sponsorMembers)
    .innerJoin(users, eq(users.id, sponsorMembers.userId))
    .where(and(eq(sponsorMembers.sponsorId, viewer.sponsor.id), eq(sponsorMembers.userId, userId)))
  if (!target) throw new AppError('NOT_FOUND', 'That person isn’t part of your company.')
  await db
    .update(sponsorMembers)
    .set({ role: 'editor' })
    .where(and(eq(sponsorMembers.sponsorId, viewer.sponsor.id), eq(sponsorMembers.userId, viewer.id)))
  await db
    .update(sponsorMembers)
    .set({ role: 'owner' })
    .where(and(eq(sponsorMembers.sponsorId, viewer.sponsor.id), eq(sponsorMembers.userId, userId)))
  await audit({ actorId: viewer.id, action: 'sponsor.ownership_transferred', entityType: 'sponsor', entityId: viewer.sponsor.id, data: { to: userId } })
  return { userId, name: target.name.trim() || target.email }
}

/** Every active member of a company, for emails (suspended people are skipped). */
export async function companyRecipients(sponsorId: string) {
  return getDb()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sponsorMembers)
    .innerJoin(users, eq(users.id, sponsorMembers.userId))
    .where(and(eq(sponsorMembers.sponsorId, sponsorId), sql`${users.suspendedAt} is null`))
    .orderBy(asc(sponsorMembers.createdAt))
}
