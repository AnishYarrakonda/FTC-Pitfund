import 'server-only'

import { eq, sql } from 'drizzle-orm'
import { cache } from 'react'

import { ACTIONABLE_TYPES } from '@/lib/shared/notifications'
import type { OrgStatus } from '@/lib/shared/types'
import type { Viewer } from '@/lib/shared/viewer'

import { getDb } from './db'
import { sponsorMembers, sponsors, teamMembers, teams, users } from './schema'
import { createSupabaseServerClient } from './supabase'

export type { Viewer }

/**
 * Loads a viewer in ONE query: the user, team or company membership, the latest pending
 * join request, and the unread notification count.
 */
export async function loadViewer(userId: string): Promise<Viewer | null> {
  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      jobTitle: users.jobTitle,
      isAdmin: users.isAdmin,
      acceptedTermsAt: users.acceptedTermsAt,
      suspendedAt: users.suspendedAt,
      team: {
        id: teams.id,
        number: teams.number,
        name: teams.name,
        logoPath: teams.logoPath,
        status: sql<OrgStatus>`case when ${teams.suspendedAt} is not null then 'suspended'::org_status else ${teams.status} end`,
      },
      sponsor: {
        id: sponsors.id,
        name: sponsors.name,
        status: sponsors.status,
        logoPath: sponsors.logoPath,
      },
      // Kept out of the nested objects above: they come from the membership tables, and mixing two
      // tables in one group stops drizzle from typing the group as a single nullable row.
      teamRole: teamMembers.role,
      sponsorRole: sponsorMembers.role,
      // The bell is a to-do list, not a log: only types in ACTIONABLE_TYPES are counted, and each is
      // cleared when the thing it points at is handled (lib/server/notify.ts resolveNotifications).
      actionCount: sql<number>`(
        select count(*)::int from notifications n
        where n.user_id = ${users.id} and n.read_at is null
          and n.type = any(${sql.param(ACTIONABLE_TYPES as unknown as string[])}::text[])
      )`,
      pendingJoin: sql<Viewer['pendingJoin']>`(
        select json_build_object(
          'requestId', r.id, 'teamId', t.id, 'teamNumber', t.number, 'teamName', t.name
        )
        from team_join_requests r join teams t on t.id = r.team_id
        where r.user_id = ${users.id} and r.status = 'pending'
        order by r.created_at desc limit 1
      )`,
    })
    .from(users)
    .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
    .leftJoin(teams, eq(teams.id, teamMembers.teamId))
    .leftJoin(sponsorMembers, eq(sponsorMembers.userId, users.id))
    .leftJoin(sponsors, eq(sponsors.id, sponsorMembers.sponsorId))
    .where(eq(users.id, userId))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  const { teamRole, sponsorRole, ...rest } = row
  return {
    ...rest,
    team: row.team?.id ? { ...row.team, role: teamRole ?? 'editor' } : null,
    sponsor: row.sponsor?.id ? { ...row.sponsor, role: sponsorRole ?? 'editor' } : null,
    actionCount: Number(row.actionCount ?? 0),
    pendingJoin: row.pendingJoin ?? null,
  }
}

type AuthClaims = {
  sub: string
  email?: string
  user_metadata?: Record<string, unknown>
}

function metaString(meta: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = meta?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** First sign-in: create the users row from auth metadata (Google provides name and avatar). */
export async function ensureUserRow(claims: AuthClaims) {
  const email = (claims.email ?? metaString(claims.user_metadata, 'email') ?? '').toLowerCase()
  if (!email) return
  await getDb()
    .insert(users)
    .values({
      id: claims.sub,
      email,
      name: (metaString(claims.user_metadata, 'full_name', 'name') ?? '').slice(0, 120),
      avatarUrl: metaString(claims.user_metadata, 'avatar_url', 'picture'),
    })
    .onConflictDoNothing()
}

/**
 * The signed-in viewer for this request, or null. Wrapped in React `cache()` so layouts and
 * pages share one session read and one query per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims as AuthClaims | undefined
  if (error || !claims?.sub) return null

  const viewer = await loadViewer(claims.sub)
  if (viewer) return viewer

  try {
    await ensureUserRow(claims)
  } catch {
    // The auth user was deleted while the cookie was still valid.
    return null
  }
  return loadViewer(claims.sub)
})
