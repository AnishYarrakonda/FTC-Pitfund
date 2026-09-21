import 'server-only'

import { and, eq, or, sql, type SQL } from 'drizzle-orm'

import type { OrgStatus } from '@/lib/shared/types'

import { getDb } from '../db'
import { sponsorMembers, sponsors, teamMembers, teams, users } from '../schema'
import { publicUrl } from '../storage'
import { keyset, type Page, type PageParams } from './keyset'

/*
 * /admin/directory: search teams, companies and people, 25 per page with cursors. Every list is
 * one query (counts are correlated subqueries on indexed foreign keys).
 */

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)
const pattern = (q: string) => `%${escapeLike(q.replaceAll('\u0000', '').trim().toLowerCase().slice(0, 100))}%`

export type DirectoryTeam = {
  id: string
  number: number
  name: string
  location: string | null
  logoUrl: string | null
  status: OrgStatus
  suspended: boolean
  members: number
  pitches: number
  createdAt: Date
}

export async function searchTeams(q: string, params: PageParams): Promise<Page<DirectoryTeam>> {
  const k = keyset<{ number: number }>({
    key: sql`${teams.number}`,
    columns: [sql`${teams.number}`],
    direction: 'asc',
    params,
    casts: ['::int'],
    cursorOf: (r) => [r.number],
  })
  const conditions: SQL[] = []
  if (q.trim()) {
    const digits = q.trim().replace(/^team\s*/i, '')
    const byName = sql`lower(${teams.name}) like ${pattern(q)}`
    conditions.push(/^\d{1,6}$/.test(digits) ? (or(byName, eq(teams.number, Number(digits))) as SQL) : byName)
  }
  if (k.condition) conditions.push(k.condition)
  const rows = await getDb()
    .select({
      id: teams.id,
      number: teams.number,
      name: teams.name,
      location: teams.location,
      logoPath: teams.logoPath,
      status: teams.status,
      suspendedAt: teams.suspendedAt,
      members: sql<number>`(select count(*)::int from team_members m where m.team_id = "teams"."id")`,
      pitches: sql<number>`(select count(*)::int from pitches p where p.team_id = "teams"."id" and p.status <> 'draft')`,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...k.orderBy)
    .limit(k.limit)
  const page = k.page(rows)
  return {
    ...page,
    items: page.items.map(({ logoPath, suspendedAt, ...r }) => ({
      ...r,
      logoUrl: publicUrl(logoPath),
      suspended: Boolean(suspendedAt),
      members: Number(r.members),
      pitches: Number(r.pitches),
    })),
  }
}

export type DirectoryCompany = {
  id: string
  name: string
  website: string
  logoUrl: string | null
  status: OrgStatus
  members: number
  pitches: number
  createdAt: Date
}

export async function searchCompanies(q: string, params: PageParams): Promise<Page<DirectoryCompany>> {
  const k = keyset<{ sortName: string; id: string }>({
    key: sql`(lower(${sponsors.name}), ${sponsors.id})`,
    columns: [sql`lower(${sponsors.name})`, sql`${sponsors.id}`],
    direction: 'asc',
    params,
    casts: ['::text', '::uuid'],
    cursorOf: (r) => [r.sortName, r.id],
  })
  const conditions: SQL[] = []
  if (q.trim()) conditions.push(sql`(lower(${sponsors.name}) like ${pattern(q)} or lower(${sponsors.website}) like ${pattern(q)})`)
  if (k.condition) conditions.push(k.condition)
  const rows = await getDb()
    .select({
      id: sponsors.id,
      sortName: sql<string>`lower(${sponsors.name})`,
      name: sponsors.name,
      website: sponsors.website,
      logoPath: sponsors.logoPath,
      status: sponsors.status,
      members: sql<number>`(select count(*)::int from sponsor_members m where m.sponsor_id = "sponsors"."id")`,
      pitches: sql<number>`(select count(*)::int from pitches p where p.sponsor_id = "sponsors"."id" and p.status in ('sent', 'matched', 'declined'))`,
      createdAt: sponsors.createdAt,
    })
    .from(sponsors)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...k.orderBy)
    .limit(k.limit)
  const page = k.page(rows)
  return {
    ...page,
    items: page.items.map(({ sortName: _sortName, logoPath, ...r }) => ({ ...r, logoUrl: publicUrl(logoPath), members: Number(r.members), pitches: Number(r.pitches) })),
  }
}

export type DirectoryPerson = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  isAdmin: boolean
  suspended: boolean
  org: { kind: 'team'; id: string; label: string } | { kind: 'sponsor'; id: string; label: string } | null
  createdAt: Date
}

export async function searchPeople(q: string, params: PageParams): Promise<Page<DirectoryPerson>> {
  const k = keyset<{ sortEmail: string }>({
    key: sql`lower(${users.email})`,
    columns: [sql`lower(${users.email})`],
    direction: 'asc',
    params,
    casts: ['::text'],
    cursorOf: (r) => [r.sortEmail],
  })
  const conditions: SQL[] = []
  if (q.trim()) conditions.push(sql`(lower(${users.email}) like ${pattern(q)} or lower(${users.name}) like ${pattern(q)})`)
  if (k.condition) conditions.push(k.condition)
  const rows = await getDb()
    .select({
      id: users.id,
      sortEmail: sql<string>`lower(${users.email})`,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      suspendedAt: users.suspendedAt,
      createdAt: users.createdAt,
      teamId: teams.id,
      teamNumber: teams.number,
      teamName: teams.name,
      sponsorId: sponsors.id,
      sponsorName: sponsors.name,
    })
    .from(users)
    .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
    .leftJoin(teams, eq(teams.id, teamMembers.teamId))
    .leftJoin(sponsorMembers, eq(sponsorMembers.userId, users.id))
    .leftJoin(sponsors, eq(sponsors.id, sponsorMembers.sponsorId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...k.orderBy)
    .limit(k.limit)
  const page = k.page(rows)
  return {
    ...page,
    items: page.items.map((r) => ({
      id: r.id,
      name: r.name.trim() || r.email,
      email: r.email,
      avatarUrl: r.avatarUrl,
      isAdmin: r.isAdmin,
      suspended: Boolean(r.suspendedAt),
      org: r.teamId
        ? { kind: 'team' as const, id: r.teamId, label: `Team ${r.teamNumber} · ${r.teamName}` }
        : r.sponsorId
          ? { kind: 'sponsor' as const, id: r.sponsorId, label: r.sponsorName ?? '' }
          : null,
      createdAt: r.createdAt,
    })),
  }
}
