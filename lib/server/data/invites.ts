import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { INVITE_TTL_DAYS } from '@/lib/shared/team'
import type { Viewer } from '@/lib/shared/viewer'

import { audit } from '../audit'
import { getDb } from '../db'
import { AppError } from '../result'
import { invites, sponsorMembers, sponsors, teamJoinRequests, teamMembers, teams, users } from '../schema'
import { publicUrl } from '../storage'

/*
 * Invites, generic over `kind = team | sponsor`. A company invites only once it is approved.
 * The token is 32 random bytes shown once (in the email link); only its SHA-256 is stored.
 * An invite is bound to one email address, expires in 14 days and works once.
 */

export type InviteKind = 'team' | 'sponsor'
export type InviteOrg = { kind: InviteKind; id: string }

const DAY = 24 * 60 * 60 * 1000

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function newInviteToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashInviteToken(token) }
}

const orgColumn = (kind: InviteKind) => (kind === 'team' ? invites.teamId : invites.sponsorId)

/** The org a viewer can invite into, from their membership. */
export function inviteOrgFor(viewer: Viewer, kind: InviteKind): InviteOrg {
  const id = kind === 'team' ? viewer.team?.id : viewer.sponsor?.id
  if (!id) throw new AppError('FORBIDDEN', kind === 'team' ? 'Join or create a team first.' : 'Set up your company first.')
  return { kind, id }
}

async function isMemberByEmail(org: InviteOrg, email: string) {
  const members = org.kind === 'team' ? teamMembers : sponsorMembers
  const orgId = org.kind === 'team' ? teamMembers.teamId : sponsorMembers.sponsorId
  const rows = await getDb()
    .select({ id: users.id })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(orgId, org.id), eq(sql`lower(${users.email})`, email.toLowerCase())))
    .limit(1)
  return rows.length > 0
}

/** Only an approved company can invite coworkers (plan §1 rule 5); teams can always invite. */
async function assertCanInvite(org: InviteOrg) {
  if (org.kind !== 'sponsor') return
  const [company] = await getDb().select({ name: sponsors.name, status: sponsors.status }).from(sponsors).where(eq(sponsors.id, org.id)).limit(1)
  if (!company) throw new AppError('NOT_FOUND', "That company doesn't exist or you're not part of it.")
  if (company.status !== 'approved') {
    throw new AppError('FORBIDDEN', company.status === 'pending' ? `You can invite coworkers once ${company.name} is approved.` : `${company.name} can’t invite coworkers right now.`)
  }
}

export async function createInvite(viewer: Viewer, org: InviteOrg, email: string, now = new Date()) {
  await assertCanInvite(org)
  const address = email.trim().toLowerCase()
  if (await isMemberByEmail(org, address)) {
    throw new AppError('CONFLICT', `${address} is already a member.`, { field: 'email' })
  }
  const [open] = await getDb()
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(orgColumn(org.kind), org.id), eq(invites.email, address), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
    .limit(1)
  if (open) throw new AppError('CONFLICT', `You already invited ${address}. Use Resend below to send it again.`, { field: 'email' })

  const { token, tokenHash } = newInviteToken()
  const [invite] = await getDb()
    .insert(invites)
    .values({
      kind: org.kind,
      teamId: org.kind === 'team' ? org.id : null,
      sponsorId: org.kind === 'sponsor' ? org.id : null,
      email: address,
      tokenHash,
      invitedBy: viewer.id,
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY),
    })
    .returning()
  await audit({ actorId: viewer.id, action: 'invite.created', entityType: 'invite', entityId: invite.id, data: { kind: org.kind, orgId: org.id, email: address } })
  return { invite, token }
}

/** A new token and a fresh 14 days; the old link stops working. */
export async function resendInvite(viewer: Viewer, org: InviteOrg, inviteId: string, now = new Date()) {
  await assertCanInvite(org)
  const { token, tokenHash } = newInviteToken()
  const [invite] = await getDb()
    .update(invites)
    .set({ tokenHash, expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY) })
    .where(and(eq(invites.id, inviteId), eq(orgColumn(org.kind), org.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
    .returning()
  if (!invite) throw new AppError('CONFLICT', 'That invite was already accepted or revoked.')
  await audit({ actorId: viewer.id, action: 'invite.resent', entityType: 'invite', entityId: invite.id, data: { kind: org.kind, orgId: org.id } })
  return { invite, token }
}

export async function revokeInvite(viewer: Viewer, org: InviteOrg, inviteId: string, now = new Date()) {
  const [invite] = await getDb()
    .update(invites)
    .set({ revokedAt: now })
    .where(and(eq(invites.id, inviteId), eq(orgColumn(org.kind), org.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
    .returning({ id: invites.id, email: invites.email })
  if (!invite) throw new AppError('CONFLICT', 'That invite was already accepted or revoked.')
  await audit({ actorId: viewer.id, action: 'invite.revoked', entityType: 'invite', entityId: invite.id, data: { kind: org.kind, orgId: org.id } })
  return invite
}

export type OpenInvite = { id: string; email: string; expiresAt: Date; createdAt: Date; expired: boolean; invitedByName: string | null }

export async function listOpenInvites(org: InviteOrg, now = new Date()): Promise<OpenInvite[]> {
  const rows = await getDb()
    .select({ id: invites.id, email: invites.email, expiresAt: invites.expiresAt, createdAt: invites.createdAt, invitedByName: users.name })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(and(eq(orgColumn(org.kind), org.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
    .orderBy(asc(invites.createdAt))
  return rows.map((r) => ({ ...r, expired: r.expiresAt.getTime() <= now.getTime() }))
}

// ─── Accepting ──────────────────────────────────────────────────────────────────────────

export type InviteState = 'valid' | 'expired' | 'revoked' | 'used'

export type InviteDetails = {
  id: string
  kind: InviteKind
  email: string
  state: InviteState
  expiresAt: Date
  org: { id: string; name: string; number: number | null; logoUrl: string | null }
  invitedByName: string | null
}

function stateOf(row: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InviteState {
  if (row.acceptedAt) return 'used'
  if (row.revokedAt) return 'revoked'
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'valid'
}

/** Look an invite up by the raw token from the link. Null when no invite has that token. */
export async function getInviteByToken(token: string, now = new Date()): Promise<InviteDetails | null> {
  if (!token || token.length > 200) return null
  const [row] = await getDb()
    .select({
      id: invites.id,
      kind: invites.kind,
      email: invites.email,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt,
      teamId: teams.id,
      teamName: teams.name,
      teamNumber: teams.number,
      teamLogo: teams.logoPath,
      sponsorId: sponsors.id,
      sponsorName: sponsors.name,
      sponsorLogo: sponsors.logoPath,
      invitedByName: users.name,
    })
    .from(invites)
    .leftJoin(teams, eq(teams.id, invites.teamId))
    .leftJoin(sponsors, eq(sponsors.id, invites.sponsorId))
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(eq(invites.tokenHash, hashInviteToken(token)))
    .limit(1)
  if (!row) return null
  const org =
    row.kind === 'team'
      ? { id: row.teamId!, name: row.teamName!, number: row.teamNumber, logoUrl: publicUrl(row.teamLogo) }
      : { id: row.sponsorId!, name: row.sponsorName!, number: null, logoUrl: publicUrl(row.sponsorLogo) }
  return { id: row.id, kind: row.kind, email: row.email, state: stateOf(row, now), expiresAt: row.expiresAt, org, invitedByName: row.invitedByName || null }
}

const STATE_MESSAGES: Record<Exclude<InviteState, 'valid'>, string> = {
  expired: 'This invite has expired. Ask for a new one.',
  revoked: 'This invite was cancelled. Ask for a new one if you still need to join.',
  used: 'This invite was already used.',
}

export async function acceptInvite(viewer: Viewer, token: string, options: { acceptsTerms: boolean; now?: Date }) {
  const now = options.now ?? new Date()
  const db = getDb()
  const [row] = await db
    .select()
    .from(invites)
    .where(eq(invites.tokenHash, hashInviteToken(token)))
    .for('update')
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND', 'That invite link isn’t valid. Check the link in your email.')
  const state = stateOf(row, now)
  if (state !== 'valid') throw new AppError('CONFLICT', STATE_MESSAGES[state])
  if (row.email.toLowerCase() !== viewer.email.toLowerCase()) {
    throw new AppError('FORBIDDEN', `This invite is for ${row.email}. You’re signed in as ${viewer.email}.`)
  }
  if (viewer.team || viewer.sponsor) {
    throw new AppError('CONFLICT', 'You’re already part of a team or company. A person can belong to only one.')
  }
  // Someone arriving from an invite link may never have seen /welcome.
  if (!viewer.acceptedTermsAt && !options.acceptsTerms) {
    throw new AppError('VALIDATION', 'Confirm that you’re 18 or older and accept the Terms to join.', { field: 'terms' })
  }
  const [org] =
    row.kind === 'team'
      ? await db.select({ blocked: sql<boolean>`${teams.suspendedAt} is not null` }).from(teams).where(eq(teams.id, row.teamId!))
      : await db.select({ blocked: sql<boolean>`${sponsors.status} in ('suspended', 'rejected')` }).from(sponsors).where(eq(sponsors.id, row.sponsorId!))
  if (!org || org.blocked) throw new AppError('FORBIDDEN', 'This team or company can’t accept new members right now.')

  if (row.kind === 'team') await db.insert(teamMembers).values({ teamId: row.teamId!, userId: viewer.id })
  else await db.insert(sponsorMembers).values({ sponsorId: row.sponsorId!, userId: viewer.id })
  await db.update(invites).set({ acceptedAt: now }).where(eq(invites.id, row.id))
  // A pending request to join some other team no longer applies.
  await db
    .update(teamJoinRequests)
    .set({ status: 'cancelled', decidedAt: now })
    .where(and(eq(teamJoinRequests.userId, viewer.id), eq(teamJoinRequests.status, 'pending')))
  await db
    .update(users)
    .set({ acceptedTermsAt: sql`coalesce(${users.acceptedTermsAt}, now())` })
    .where(eq(users.id, viewer.id))
  await audit({
    actorId: viewer.id,
    action: 'invite.accepted',
    entityType: 'invite',
    entityId: row.id,
    data: { kind: row.kind, orgId: row.teamId ?? row.sponsorId },
  })
  return { kind: row.kind, orgId: (row.teamId ?? row.sponsorId)!, home: row.kind === 'team' ? '/pitches' : '/inbox' }
}

export const ACCEPT_INVITE_CONFLICTS = {
  team_members_user_key: 'You’re already on a team. A person can belong to only one team or company.',
  sponsor_members_user_key: 'You’re already part of a company. A person can belong to only one team or company.',
}
