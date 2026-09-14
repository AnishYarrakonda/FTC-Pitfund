import 'server-only'

import { and, asc, count, desc, eq, isNull, ne, sql } from 'drizzle-orm'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { DECK_MESSAGES } from '@/lib/shared/team'
import type { Viewer } from '@/lib/shared/viewer'

import type { TeamViewer } from '../authz'
import { audit } from '../audit'
import { getDb } from '../db'
import { lookupFtcTeam, type FtcLookup } from '../ftc-records'
import { AppError } from '../result'
import { ftcTeamCache, invites, sponsorMembers, teamJoinRequests, teamMembers, teams, users } from '../schema'
import { BUCKETS, promoteFromStaging, publicUrl, uploadObject } from '../storage'
import {
  assertOwnStagingPath,
  createStagingUpload,
  discard,
  publishVerified,
  readReceipt,
  readStaged,
  signReceipt,
  verifyImageBytes,
  verifyPdfBytes,
} from '../uploads'

/*
 * Teams: first-run creation, the editable profile, members and join requests, and the deck and
 * logo files. Every function takes the viewer from lib/server/authz.ts; callers run multi-write
 * functions inside inTransaction() so audit and notification rows commit together.
 */

// ─── First run ──────────────────────────────────────────────────────────────────────────

export type WelcomeLookup =
  | FtcLookup
  | {
      status: 'on_pitfund'
      team: { id: string; number: number; name: string; city: string | null; state: string | null; logoUrl: string | null; suspended: boolean }
    }

/** "Is this your team?": already on FTC Pitfund, or what FIRST records say. Never throws for outages. */
export async function lookupTeamNumber(number: number, options: Parameters<typeof lookupFtcTeam>[1] = {}): Promise<WelcomeLookup> {
  const [existing] = await getDb()
    .select({ id: teams.id, number: teams.number, name: teams.name, city: teams.city, state: teams.state, logoPath: teams.logoPath, suspendedAt: teams.suspendedAt })
    .from(teams)
    .where(eq(teams.number, number))
    .limit(1)
  if (existing) {
    return {
      status: 'on_pitfund',
      team: { ...existing, logoUrl: publicUrl(existing.logoPath), suspended: Boolean(existing.suspendedAt) },
    }
  }
  return lookupFtcTeam(number, options)
}

export type CreateTeamData = {
  number: number
  name: string
  city: string
  state: string
  country?: string | null
  source: 'matched' | 'manual' | 'unchecked'
}

export async function createTeam(viewer: Viewer, input: CreateTeamData) {
  if (viewer.team || viewer.sponsor) throw new AppError('CONFLICT', 'You’re already part of a team or company.')
  if (viewer.pendingJoin) {
    throw new AppError('CONFLICT', `Cancel your request to join Team ${viewer.pendingJoin.teamNumber} first.`)
  }
  const db = getDb()

  // "matched" is only believed when FIRST records actually list this number.
  let recordStatus = input.source
  let country = input.country ?? null
  if (input.source === 'matched') {
    const [record] = await db.select({ country: ftcTeamCache.country }).from(ftcTeamCache).where(eq(ftcTeamCache.number, input.number)).limit(1)
    if (record) country = country ?? record.country
    else recordStatus = 'unchecked'
  }

  const [team] = await db
    .insert(teams)
    .values({ number: input.number, name: input.name, city: input.city, state: input.state, country, recordStatus })
    .returning({ id: teams.id, number: teams.number, name: teams.name })
  await db.insert(teamMembers).values({ teamId: team.id, userId: viewer.id })
  await db
    .update(users)
    .set({ acceptedTermsAt: sql`coalesce(${users.acceptedTermsAt}, now())` })
    .where(eq(users.id, viewer.id))
  await audit({ actorId: viewer.id, action: 'team.created', entityType: 'team', entityId: team.id, data: { number: team.number, recordStatus } })
  return team
}

export const CREATE_TEAM_CONFLICTS = {
  teams_number_key: 'That team is already on FTC Pitfund. Look the number up again and ask to join it.',
  team_members_user_key: 'You’re already on a team.',
}

// ─── Profile ────────────────────────────────────────────────────────────────────────────

export type TeamProfile = {
  id: string
  number: number
  name: string
  city: string | null
  state: string | null
  country: string | null
  website: string | null
  summary: string | null
  logoUrl: string | null
  deck: { url: string; downloadUrl: string; pages: number; bytes: number; thumbUrl: string | null; updatedAt: Date } | null
  recordStatus: 'matched' | 'manual' | 'unchecked'
  verifiedAt: Date | null
  createdAt: Date
}

function toProfile(row: typeof teams.$inferSelect): TeamProfile {
  const deckUrl = publicUrl(row.pdfPath)
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
    website: row.website,
    summary: row.summary,
    logoUrl: publicUrl(row.logoPath),
    deck:
      deckUrl && row.pdfPages && row.pdfBytes && row.pdfUpdatedAt
        ? {
            url: deckUrl,
            downloadUrl: `${deckUrl}?download=${encodeURIComponent(`Team ${row.number} sponsorship deck.pdf`)}`,
            pages: row.pdfPages,
            bytes: row.pdfBytes,
            thumbUrl: publicUrl(row.pdfThumbPath),
            updatedAt: row.pdfUpdatedAt,
          }
        : null,
    recordStatus: row.recordStatus,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
  }
}

export async function getTeamProfile(viewer: TeamViewer): Promise<TeamProfile> {
  const [row] = await getDb().select().from(teams).where(eq(teams.id, viewer.team.id)).limit(1)
  if (!row) throw new AppError('NOT_FOUND', "That team doesn't exist or you're not on it.")
  return toProfile(row)
}

export async function updateTeamProfile(
  viewer: TeamViewer,
  input: { name: string; city: string; state: string; summary: string | null; website: string | null },
) {
  const [row] = await getDb().update(teams).set(input).where(eq(teams.id, viewer.team.id)).returning()
  if (!row) throw new AppError('NOT_FOUND', "That team doesn't exist or you're not on it.")
  await audit({ actorId: viewer.id, action: 'team.profile_updated', entityType: 'team', entityId: row.id, data: { fields: Object.keys(input) } })
  return toProfile(row)
}

/** Everything the /pitches setup checklist needs, in one query. */
export async function getTeamSetup(viewer: TeamViewer) {
  const [row] = await getDb()
    .select({
      hasDeck: sql<boolean>`${teams.pdfPath} is not null`,
      hasSummary: sql<boolean>`coalesce(${teams.summary}, '') <> ''`,
      hasLogo: sql<boolean>`${teams.logoPath} is not null`,
      memberCount: sql<number>`(select count(*)::int from ${teamMembers} where ${teamMembers.teamId} = ${teams.id})`,
      pendingInvites: sql<number>`(select count(*)::int from ${invites} where ${invites.teamId} = ${teams.id} and ${invites.acceptedAt} is null and ${invites.revokedAt} is null and ${invites.expiresAt} > now())`,
    })
    .from(teams)
    .where(eq(teams.id, viewer.team.id))
  return {
    hasDeck: Boolean(row?.hasDeck),
    hasSummary: Boolean(row?.hasSummary),
    hasLogo: Boolean(row?.hasLogo),
    memberCount: Number(row?.memberCount ?? 1),
    pendingInvites: Number(row?.pendingInvites ?? 0),
  }
}

// ─── Members ────────────────────────────────────────────────────────────────────────────

export type TeamMemberRow = { userId: string; name: string; email: string; avatarUrl: string | null; joinedAt: Date }

export async function listTeamMembers(viewer: TeamViewer): Promise<TeamMemberRow[]> {
  return getDb()
    .select({ userId: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, joinedAt: teamMembers.createdAt })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, viewer.team.id))
    .orderBy(asc(teamMembers.createdAt))
}

async function otherMemberCount(teamId: string, userId: string) {
  const [row] = await getDb()
    .select({ n: count() })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), ne(teamMembers.userId, userId)))
  return Number(row?.n ?? 0)
}

export async function removeTeamMember(viewer: TeamViewer, userId: string) {
  if (userId === viewer.id) throw new AppError('VALIDATION', 'To leave the team yourself, use Leave team.')
  const rows = await getDb()
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, viewer.team.id), eq(teamMembers.userId, userId)))
    .returning({ userId: teamMembers.userId })
  if (!rows[0]) throw new AppError('NOT_FOUND', 'That person isn’t on your team anymore.')
  const [person] = await getDb().select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId))
  await audit({ actorId: viewer.id, action: 'team.member_removed', entityType: 'team', entityId: viewer.team.id, data: { userId } })
  return { userId, name: person?.name || person?.email || 'That person' }
}

export async function leaveTeam(viewer: TeamViewer) {
  const db = getDb()
  // Lock the team's membership so two last members can't leave at the same moment.
  await db.execute(sql`select 1 from ${teams} where ${teams.id} = ${viewer.team.id} for update`)
  if ((await otherMemberCount(viewer.team.id, viewer.id)) === 0) {
    throw new AppError(
      'CONFLICT',
      `You’re the only member of Team ${viewer.team.number}. Invite another coach first, or email ${SUPPORT_EMAIL} to delete the team.`,
    )
  }
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, viewer.team.id), eq(teamMembers.userId, viewer.id)))
  await audit({ actorId: viewer.id, action: 'team.member_left', entityType: 'team', entityId: viewer.team.id, data: { userId: viewer.id } })
  return { teamId: viewer.team.id }
}

// ─── Join requests ──────────────────────────────────────────────────────────────────────

export async function requestToJoinTeam(viewer: Viewer, teamId: string) {
  if (viewer.team || viewer.sponsor) throw new AppError('CONFLICT', 'You’re already part of a team or company.')
  if (viewer.pendingJoin) {
    if (viewer.pendingJoin.teamId === teamId) throw new AppError('CONFLICT', 'You’ve already asked to join this team.')
    throw new AppError('CONFLICT', `Cancel your request to join Team ${viewer.pendingJoin.teamNumber} first.`)
  }
  const [team] = await getDb()
    .select({ id: teams.id, number: teams.number, name: teams.name, suspendedAt: teams.suspendedAt })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)
  if (!team) throw new AppError('NOT_FOUND', 'That team isn’t on FTC Pitfund anymore.')
  if (team.suspendedAt) throw new AppError('FORBIDDEN', `Team ${team.number} can’t accept new members right now. Email ${SUPPORT_EMAIL} for help.`)

  const [request] = await getDb().insert(teamJoinRequests).values({ teamId, userId: viewer.id }).returning({ id: teamJoinRequests.id })
  await audit({ actorId: viewer.id, action: 'join_request.created', entityType: 'join_request', entityId: request.id, data: { teamId } })
  const members = await getDb()
    .select({ userId: users.id, email: users.email })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(and(eq(teamMembers.teamId, teamId), isNull(users.suspendedAt)))
  return { requestId: request.id, team, members }
}

export const JOIN_REQUEST_CONFLICTS = { team_join_requests_pending_key: 'You’ve already asked to join this team.' }

export type JoinRequestRow = { id: string; userId: string; name: string; email: string; createdAt: Date }

export async function listPendingJoinRequests(viewer: TeamViewer): Promise<JoinRequestRow[]> {
  return getDb()
    .select({ id: teamJoinRequests.id, userId: users.id, name: users.name, email: users.email, createdAt: teamJoinRequests.createdAt })
    .from(teamJoinRequests)
    .innerJoin(users, eq(users.id, teamJoinRequests.userId))
    .where(and(eq(teamJoinRequests.teamId, viewer.team.id), eq(teamJoinRequests.status, 'pending')))
    .orderBy(desc(teamJoinRequests.createdAt))
}

export async function decideJoinRequest(viewer: TeamViewer, requestId: string, decision: 'approve' | 'decline') {
  const db = getDb()
  const [request] = await db
    .update(teamJoinRequests)
    .set({ status: decision === 'approve' ? 'approved' : 'declined', decidedBy: viewer.id, decidedAt: new Date() })
    .where(and(eq(teamJoinRequests.id, requestId), eq(teamJoinRequests.teamId, viewer.team.id), eq(teamJoinRequests.status, 'pending')))
    .returning({ id: teamJoinRequests.id, userId: teamJoinRequests.userId })
  if (!request) throw new AppError('CONFLICT', 'That request was already answered or cancelled.')

  const [person] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, request.userId))
  const name = person?.name || person?.email || 'That person'
  if (decision === 'approve') {
    const [company] = await db.select({ n: count() }).from(sponsorMembers).where(eq(sponsorMembers.userId, request.userId))
    if (Number(company?.n ?? 0) > 0) throw new AppError('CONFLICT', `${name} has since joined a company, so they can’t join a team.`)
    await db.insert(teamMembers).values({ teamId: viewer.team.id, userId: request.userId })
  }
  await audit({
    actorId: viewer.id,
    action: decision === 'approve' ? 'join_request.approved' : 'join_request.declined',
    entityType: 'join_request',
    entityId: request.id,
    data: { teamId: viewer.team.id, userId: request.userId },
  })
  return { ...request, name, email: person?.email ?? null }
}

export const DECIDE_JOIN_CONFLICTS = { team_members_user_key: 'That person has since joined another team.' }

// ─── Files ──────────────────────────────────────────────────────────────────────────────

const teamPrefix = (teamId: string) => `teams/${teamId}`

export async function createTeamUpload(viewer: TeamViewer, purpose: 'deck' | 'thumb' | 'logo', imageExt: 'webp' | 'jpg' = 'webp') {
  return createStagingUpload(teamPrefix(viewer.team.id), purpose === 'deck' ? 'pdf' : imageExt)
}

/**
 * Step 2 of the deck upload ("Checking your PDF…"): verify the staged file, keep a
 * server-written copy the browser can't overwrite, and hand back a signed receipt.
 */
export async function checkStagedDeck(viewer: TeamViewer, stagingPath: string) {
  const prefix = teamPrefix(viewer.team.id)
  assertOwnStagingPath(stagingPath, prefix)
  const bytes = await readStaged(stagingPath)
  let verified: { pages: number; bytes: number }
  try {
    verified = await verifyPdfBytes(bytes)
  } finally {
    await discard('staging', [stagingPath])
  }
  const verifiedPath = `${prefix}/verified-${crypto.randomUUID()}.pdf`
  await uploadObject(BUCKETS.staging, verifiedPath, bytes, 'application/pdf')
  return { ...verified, receipt: signReceipt({ scope: `team:${viewer.team.id}`, path: verifiedPath, ...verified }) }
}

/**
 * Step 3 ("Creating preview…"): publish the verified deck and the page-1 thumbnail rendered in
 * the browser, point the team at them, and return the objects to delete once committed.
 */
export async function finalizeDeck(viewer: TeamViewer, input: { receipt: string; thumbPath: string; consent: boolean }) {
  if (!input.consent) throw new AppError('VALIDATION', DECK_MESSAGES.consent, { field: 'consent' })
  const prefix = teamPrefix(viewer.team.id)
  const receipt = readReceipt(input.receipt, `team:${viewer.team.id}`)
  if (!receipt.path.startsWith(`${prefix}/verified-`)) throw new AppError('NOT_FOUND', 'That upload doesn’t exist or isn’t yours. Upload the file again.')
  assertOwnStagingPath(input.thumbPath, prefix)

  const thumbBytes = await readStaged(input.thumbPath)
  const thumbKind = verifyImageBytes(thumbBytes, 'preview image')
  const [before] = await getDb().select({ pdfPath: teams.pdfPath, thumbPath: teams.pdfThumbPath }).from(teams).where(eq(teams.id, viewer.team.id))

  const pdfPath = `${prefix}/deck-${crypto.randomUUID()}.pdf`
  try {
    await promoteFromStaging(receipt.path, pdfPath, 'application/pdf')
  } catch {
    throw new AppError('NOT_FOUND', 'We couldn’t find your checked PDF. It may have expired. Upload the file again.')
  }
  const thumbPath = await publishVerified(prefix, 'thumb', thumbBytes, thumbKind)
  await discard('staging', [input.thumbPath])

  const now = new Date()
  const [row] = await getDb()
    .update(teams)
    .set({ pdfPath, pdfPages: receipt.pages, pdfBytes: receipt.bytes, pdfThumbPath: thumbPath, pdfUpdatedAt: now, mediaConsentAt: now })
    .where(eq(teams.id, viewer.team.id))
    .returning()
  await audit({ actorId: viewer.id, action: 'team.deck_updated', entityType: 'team', entityId: viewer.team.id, data: { pages: receipt.pages, bytes: receipt.bytes } })
  return { profile: toProfile(row), replaced: [before?.pdfPath, before?.thumbPath], published: [pdfPath, thumbPath] }
}

export async function finalizeTeamLogo(viewer: TeamViewer, stagingPath: string) {
  const prefix = teamPrefix(viewer.team.id)
  assertOwnStagingPath(stagingPath, prefix)
  const bytes = await readStaged(stagingPath)
  const kind = verifyImageBytes(bytes, 'logo')
  const [before] = await getDb().select({ logoPath: teams.logoPath }).from(teams).where(eq(teams.id, viewer.team.id))
  const logoPath = await publishVerified(prefix, 'logo', bytes, kind)
  await discard('staging', [stagingPath])
  const [row] = await getDb().update(teams).set({ logoPath }).where(eq(teams.id, viewer.team.id)).returning()
  await audit({ actorId: viewer.id, action: 'team.logo_updated', entityType: 'team', entityId: viewer.team.id })
  return { profile: toProfile(row), replaced: [before?.logoPath], published: [logoPath] }
}
