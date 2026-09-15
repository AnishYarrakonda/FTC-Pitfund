import 'server-only'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'

import { getDb } from './db'
import { notifications, sponsorMembers, teamMembers, users } from './schema'

/*
 * In-app notifications. They are written regardless of email, inside the same transaction as
 * the state change, so email is always a copy and never the only channel. Fan-out is one
 * INSERT … SELECT per org, not a loop.
 */

export type NotificationInput = {
  type: string
  title: string
  body?: string | null
  href?: string | null
}

type Fanout = { exceptUserId?: string | null }

export async function notifyUsers(userIds: string[], n: NotificationInput) {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return 0
  const rows = await getDb()
    .insert(notifications)
    .values(unique.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body ?? null, href: n.href ?? null })))
    .returning({ id: notifications.id })
  return rows.length
}

function values(n: NotificationInput) {
  return sql`${n.type}, ${n.title}, ${n.body ?? null}, ${n.href ?? null}`
}

/** Notify every member of a team (optionally skipping the person who acted). */
export async function notifyTeam(teamId: string, n: NotificationInput, { exceptUserId }: Fanout = {}) {
  const exclude = exceptUserId ? ne(teamMembers.userId, exceptUserId) : undefined
  const result = await getDb().execute(sql`
    insert into ${notifications} (user_id, type, title, body, href)
    select ${teamMembers.userId}, ${values(n)} from ${teamMembers}
    where ${and(eq(teamMembers.teamId, teamId), exclude)}
  `)
  return result.count
}

/** Notify every member of a company (optionally skipping the person who acted). */
export async function notifySponsor(sponsorId: string, n: NotificationInput, { exceptUserId }: Fanout = {}) {
  const exclude = exceptUserId ? ne(sponsorMembers.userId, exceptUserId) : undefined
  const result = await getDb().execute(sql`
    insert into ${notifications} (user_id, type, title, body, href)
    select ${sponsorMembers.userId}, ${values(n)} from ${sponsorMembers}
    where ${and(eq(sponsorMembers.sponsorId, sponsorId), exclude)}
  `)
  return result.count
}

/** Notify every (non-suspended) admin. */
export async function notifyAdmins(n: NotificationInput, { exceptUserId }: Fanout = {}) {
  const exclude = exceptUserId ? ne(users.id, exceptUserId) : undefined
  const result = await getDb().execute(sql`
    insert into ${notifications} (user_id, type, title, body, href)
    select ${users.id}, ${values(n)} from ${users}
    where ${and(eq(users.isAdmin, true), isNull(users.suspendedAt), exclude)}
  `)
  return result.count
}
