import 'server-only'

import { and, asc, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'

import { placeLabel } from '@/lib/shared/team'

import { getDb } from './db'
import { enqueueEmail, PRIORITY } from './email/outbox'
import { absoluteUrl } from './env'
import { emailOutbox, pitches, reports, sponsorMembers, sponsors, teams, users } from './schema'

/*
 * The daily admin digest (prompt 3, scope F): new teams since the last digest, companies waiting for
 * approval, open reports and pitches waiting over 24 h. Priority 3, so it never crowds out
 * transactional email, and deduplicated per admin per day so running the cron twice sends it once.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const LIST_LIMIT = 10

export type DigestContent = {
  since: Date
  newTeams: Array<{ id: string; number: number; name: string; place: string | null }>
  newTeamsTotal: number
  pendingCompanies: Array<{ id: string; name: string; applicant: string | null }>
  pendingCompaniesTotal: number
  openReports: number
  waitingPitches: number
  oldestWaitingHours: number | null
}

const digestDate = (now: Date) => now.toISOString().slice(0, 10)

/** What the digest would say right now, or null when nothing is waiting. */
export async function buildDigest(now = new Date()): Promise<DigestContent | null> {
  const db = getDb()
  const [last] = await db
    .select({ createdAt: emailOutbox.createdAt })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.template, 'admin-digest'), lt(emailOutbox.createdAt, new Date(now.getTime() - 60_000))))
    .orderBy(desc(emailOutbox.createdAt))
    .limit(1)
  const since = last?.createdAt ?? new Date(now.getTime() - DAY_MS)
  const waitingBefore = new Date(now.getTime() - DAY_MS)

  const [newTeams, companies, [counts]] = await Promise.all([
    db
      .select({ id: teams.id, number: teams.number, name: teams.name, location: teams.location, total: sql<number>`count(*) over ()::int` })
      .from(teams)
      // Teams waiting on a decision, not every team that signed up: a draft nobody submitted is not
      // the admin's work yet.
      .where(and(gt(teams.createdAt, since), eq(teams.status, 'pending'), isNull(teams.suspendedAt)))
      .orderBy(desc(teams.createdAt))
      .limit(LIST_LIMIT),
    db
      .select({
        id: sponsors.id,
        name: sponsors.name,
        total: sql<number>`count(*) over ()::int`,
        applicant: sql<string | null>`(select coalesce(nullif(u.name, ''), u.email) from ${sponsorMembers} m join ${users} u on u.id = m.user_id where m.sponsor_id = "sponsors"."id" order by m.created_at asc limit 1)`,
      })
      .from(sponsors)
      .where(eq(sponsors.status, 'pending'))
      .orderBy(asc(sponsors.createdAt))
      .limit(LIST_LIMIT),
    db
      .select({
        openReports: sql<number>`(select count(*)::int from ${reports} where status = 'open')`,
        waitingPitches: sql<number>`(select count(*)::int from ${pitches} where status = 'in_review' and submitted_at < ${waitingBefore.toISOString()}::timestamptz)`,
        oldest: sql<string | null>`(select min(submitted_at)::text from ${pitches} where status = 'in_review' and submitted_at < ${waitingBefore.toISOString()}::timestamptz)`,
      })
      .from(sql`(select 1) as one`),
  ])

  const content: DigestContent = {
    since,
    newTeams: newTeams.map((t) => ({ id: t.id, number: t.number, name: t.name, place: placeLabel(t) || null })),
    newTeamsTotal: Number(newTeams[0]?.total ?? 0),
    pendingCompanies: companies.map((c) => ({ id: c.id, name: c.name, applicant: c.applicant })),
    pendingCompaniesTotal: Number(companies[0]?.total ?? 0),
    openReports: Number(counts?.openReports ?? 0),
    waitingPitches: Number(counts?.waitingPitches ?? 0),
    oldestWaitingHours: counts?.oldest ? Math.floor((now.getTime() - new Date(counts.oldest).getTime()) / (60 * 60 * 1000)) : null,
  }
  const empty = !content.newTeamsTotal && !content.pendingCompaniesTotal && !content.openReports && !content.waitingPitches
  return empty ? null : content
}

/** Enqueue today's digest for every admin (no-op when nothing is waiting or it was already queued today). */
export async function enqueueAdminDigest(now = new Date()) {
  const content = await buildDigest(now)
  if (!content) return { skipped: true as const, reason: 'Nothing is waiting' }
  const admins = await getDb().select({ id: users.id, email: users.email }).from(users).where(and(eq(users.isAdmin, true), isNull(users.suspendedAt)))
  const date = digestDate(now)
  const clip = (s: string, n = 200) => s.slice(0, n)
  let queued = 0
  let deduped = 0
  for (const admin of admins) {
    const result = await enqueueEmail({
      to: admin.email,
      template: 'admin-digest',
      data: {
        dateLabel: now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }),
        newTeams: content.newTeams.map((t) => ({ number: t.number, name: clip(t.name), place: t.place ? clip(t.place) : null, url: absoluteUrl(`/admin/teams/${t.id}`) })),
        newTeamsTotal: content.newTeamsTotal,
        pendingCompanies: content.pendingCompanies.map((c) => ({ name: clip(c.name), applicant: c.applicant ? clip(c.applicant) : null, url: absoluteUrl(`/admin/companies/${c.id}`) })),
        pendingCompaniesTotal: content.pendingCompaniesTotal,
        openReports: content.openReports,
        waitingPitches: content.waitingPitches,
        oldestWaitingHours: content.oldestWaitingHours,
        reviewUrl: absoluteUrl('/admin'),
      },
      priority: PRIORITY.digest,
      dedupeKey: `digest:${date}:${admin.id}`,
      now,
    })
    if (result.deduped) deduped++
    else queued++
  }
  return { skipped: false as const, queued, deduped, admins: admins.length }
}
