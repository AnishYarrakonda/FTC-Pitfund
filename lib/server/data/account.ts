import 'server-only'

import { and, count, eq, ne } from 'drizzle-orm'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import type { Viewer } from '@/lib/shared/viewer'

import { audit } from '../audit'
import { getDb, transaction } from '../db'
import { AppError } from '../result'
import { sponsorMembers, teamJoinRequests, teamMembers, users } from '../schema'
import { createSupabaseAdminClient } from '../supabase-admin'

export async function updateProfile(viewer: Viewer, input: { name: string; phone: string | null; jobTitle?: string | null }) {
  const [row] = await getDb()
    .update(users)
    .set({
      name: input.name,
      phone: input.phone,
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
    })
    .where(eq(users.id, viewer.id))
    .returning({ name: users.name, phone: users.phone, jobTitle: users.jobTitle })
  return row
}

export type DeletionBlocker = { kind: 'team' | 'sponsor'; name: string } | null

/** A person can't leave an org memberless: the last member must hand over or ask support. */
export async function accountDeletionBlocker(viewer: Viewer): Promise<DeletionBlocker> {
  if (viewer.team) {
    const [row] = await getDb()
      .select({ n: count() })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, viewer.team.id), ne(teamMembers.userId, viewer.id)))
    if (Number(row?.n ?? 0) === 0) return { kind: 'team', name: `Team ${viewer.team.number} · ${viewer.team.name}` }
  }
  if (viewer.sponsor) {
    const [row] = await getDb()
      .select({ n: count() })
      .from(sponsorMembers)
      .where(and(eq(sponsorMembers.sponsorId, viewer.sponsor.id), ne(sponsorMembers.userId, viewer.id)))
    if (Number(row?.n ?? 0) === 0) return { kind: 'sponsor', name: viewer.sponsor.name }
  }
  return null
}

export function deletionBlockerMessage(blocker: NonNullable<DeletionBlocker>) {
  const what = blocker.kind === 'team' ? 'team' : 'company'
  return `You're the only member of ${blocker.name}. Invite another member first, or email ${SUPPORT_EMAIL} to close the ${what}.`
}

/**
 * Delete the person: the auth user goes, and the users row and memberships cascade with it.
 * Pitches, audit events and decisions they made stay, with the actor set to null.
 */
export async function deleteAccount(viewer: Viewer) {
  const blocker = await accountDeletionBlocker(viewer)
  if (blocker) throw new AppError('CONFLICT', deletionBlockerMessage(blocker))

  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(viewer.id)
  if (error) throw new Error(`Auth user deletion failed: ${error.message}`)

  // The users row, memberships and join requests are gone by cascade; the event stays.
  await audit({
    actorId: null,
    action: 'user.deleted',
    entityType: 'user',
    entityId: viewer.id,
    data: { teamId: viewer.team?.id ?? null, sponsorId: viewer.sponsor?.id ?? null },
  })
}

export async function acceptTerms(viewer: Viewer, name: string) {
  await getDb()
    .update(users)
    .set({ acceptedTermsAt: viewer.acceptedTermsAt ?? new Date(), ...(name ? { name } : {}) })
    .where(eq(users.id, viewer.id))
}

export async function cancelJoinRequest(viewer: Viewer, requestId: string) {
  return transaction(async () => {
    const rows = await getDb()
      .update(teamJoinRequests)
      .set({ status: 'cancelled', decidedAt: new Date() })
      .where(and(eq(teamJoinRequests.id, requestId), eq(teamJoinRequests.userId, viewer.id), eq(teamJoinRequests.status, 'pending')))
      .returning({ id: teamJoinRequests.id, teamId: teamJoinRequests.teamId })
    if (!rows[0]) throw new AppError('CONFLICT', 'That request was already answered or cancelled.')
    await audit({ actorId: viewer.id, action: 'join_request.cancelled', entityType: 'join_request', entityId: rows[0].id, data: { teamId: rows[0].teamId } })
    return rows[0]
  })
}
