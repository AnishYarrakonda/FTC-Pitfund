import 'server-only'

import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { placeLabel } from '@/lib/shared/team'

import { getDb } from './db'
import { DAILY_EMAIL_LIMIT, enqueueEmail, PRIORITY, quotaUsage } from './email/outbox'
import { absoluteUrl } from './env'
import { auditEvents, emailOutbox, pitches, reports, sponsorMembers, sponsors, teams, users } from './schema'

/*
 * The daily summary: how many emails went out through Resend in the last 24 hours (and how close that
 * is to the free plan's 100), what happened in the app, and what is waiting for an admin. It is sent
 * every day, even a quiet one, because the email count is the signal to upgrade Resend. Priority 3 sits
 * behind transactional mail but shares its 90 budget, so it still arrives on a busy day. Deduplicated
 * per recipient per day so running the cron twice sends it once.
 */

/** Always receive the summary, whether or not they are an admin account. */
export const DIGEST_RECIPIENTS = [SUPPORT_EMAIL]

const DAY_MS = 24 * 60 * 60 * 1000
const LIST_LIMIT = 10

/** How many of the last 24 hours' emails to flag as "nearing the free plan". */
export const EMAIL_WARN_AT = 80

const ACTIVITY: Array<{ key: string; label: string; actions: string[] }> = [
  { key: 'teamsSubmitted', label: 'Teams submitted for review', actions: ['team.submitted'] },
  { key: 'teamsDecided', label: 'Teams approved or rejected', actions: ['team.approved', 'team.rejected'] },
  { key: 'companiesSubmitted', label: 'Companies submitted for review', actions: ['sponsor.submitted'] },
  { key: 'companiesDecided', label: 'Companies approved or rejected', actions: ['sponsor.approved', 'sponsor.rejected'] },
  { key: 'pitchesSubmitted', label: 'Pitches submitted', actions: ['pitch.submitted'] },
  { key: 'pitchesMatched', label: 'Pitches matched', actions: ['pitch.matched'] },
  { key: 'pitchesDeclined', label: 'Pitches answered "Not a fit"', actions: ['pitch.declined'] },
  { key: 'reportsFiled', label: 'Reports filed', actions: ['report.created'] },
]

type DigestEmail = {
  /** Sent in the rolling 24 hours, before this summary. What Resend's daily limit counts. */
  sent24h: number
  limit: number
  failed24h: number
  bounced24h: number
  waiting: number
  sentThisMonth: number
  byKind: Array<{ label: string; count: number }>
}

export type DigestContent = {
  since: Date
  newTeams: Array<{ id: string; number: number; name: string; place: string | null }>
  newTeamsTotal: number
  pendingCompanies: Array<{ id: string; name: string; applicant: string | null }>
  pendingCompaniesTotal: number
  openReports: number
  waitingPitches: number
  oldestWaitingHours: number | null
  newUsers: number
  activity: Array<{ label: string; count: number }>
  email: DigestEmail
}

const digestDate = (now: Date) => now.toISOString().slice(0, 10)

/** What the summary would say right now. */
export async function buildDigest(now = new Date()): Promise<DigestContent> {
  const db = getDb()
  const [last] = await db
    .select({ createdAt: emailOutbox.createdAt })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.template, 'admin-digest'), lt(emailOutbox.createdAt, new Date(now.getTime() - 60_000))))
    .orderBy(desc(emailOutbox.createdAt))
    .limit(1)
  const since = last?.createdAt ?? new Date(now.getTime() - DAY_MS)
  const waitingBefore = new Date(now.getTime() - DAY_MS)

  const dayAgo = new Date(now.getTime() - DAY_MS)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const activityActions = ACTIVITY.flatMap((a) => a.actions)

  const [newTeams, companies, [counts], usage, activityRows, [people], statusRows, kindRows, [month]] = await Promise.all([
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
    quotaUsage(now),
    db
      .select({ action: auditEvents.action, n: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(and(gt(auditEvents.createdAt, dayAgo), inArray(auditEvents.action, activityActions)))
      .groupBy(auditEvents.action),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(gt(users.createdAt, dayAgo)),
    db
      .select({ status: emailOutbox.status, n: sql<number>`count(*)::int` })
      .from(emailOutbox)
      .where(or(and(inArray(emailOutbox.status, ['failed', 'bounced']), gt(emailOutbox.updatedAt, dayAgo)), eq(emailOutbox.status, 'queued')))
      .groupBy(emailOutbox.status),
    db
      .select({ template: emailOutbox.template, n: sql<number>`count(*)::int` })
      .from(emailOutbox)
      .where(gt(emailOutbox.sentAt, dayAgo))
      .groupBy(emailOutbox.template)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db.select({ n: sql<number>`count(*)::int` }).from(emailOutbox).where(gte(emailOutbox.sentAt, monthStart)),
  ])

  const byAction = new Map(activityRows.map((r) => [r.action, Number(r.n)]))
  const byStatus = new Map(statusRows.map((r) => [r.status, Number(r.n)]))
  const activity = ACTIVITY.map((a) => ({ label: a.label, count: a.actions.reduce((sum, x) => sum + (byAction.get(x) ?? 0), 0) })).filter((a) => a.count > 0)

  const content: DigestContent = {
    since,
    newTeams: newTeams.map((t) => ({ id: t.id, number: t.number, name: t.name, place: placeLabel(t) || null })),
    newTeamsTotal: Number(newTeams[0]?.total ?? 0),
    pendingCompanies: companies.map((c) => ({ id: c.id, name: c.name, applicant: c.applicant })),
    pendingCompaniesTotal: Number(companies[0]?.total ?? 0),
    openReports: Number(counts?.openReports ?? 0),
    waitingPitches: Number(counts?.waitingPitches ?? 0),
    oldestWaitingHours: counts?.oldest ? Math.floor((now.getTime() - new Date(counts.oldest).getTime()) / (60 * 60 * 1000)) : null,
    newUsers: Number(people?.n ?? 0),
    activity,
    email: {
      sent24h: usage.sentInWindow,
      limit: DAILY_EMAIL_LIMIT,
      failed24h: byStatus.get('failed') ?? 0,
      bounced24h: byStatus.get('bounced') ?? 0,
      waiting: byStatus.get('queued') ?? 0,
      sentThisMonth: Number(month?.n ?? 0),
      byKind: kindRows.map((r) => ({ label: r.template.replaceAll('-', ' '), count: Number(r.n) })),
    },
  }
  return content
}

/** Enqueue today's summary for every admin and the fixed recipients (a no-op for anyone who already has it). */
export async function enqueueAdminDigest(now = new Date()) {
  const content = await buildDigest(now)
  const adminRows = await getDb().select({ email: users.email }).from(users).where(and(eq(users.isAdmin, true), isNull(users.suspendedAt)))
  const recipients = [...new Set([...DIGEST_RECIPIENTS, ...adminRows.map((a) => a.email)].map((e) => e.trim().toLowerCase()))]
  const date = digestDate(now)
  const clip = (s: string, n = 200) => s.slice(0, n)
  let queued = 0
  let deduped = 0
  for (const to of recipients) {
    const result = await enqueueEmail({
      to,
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
        newUsers: content.newUsers,
        activity: content.activity,
        email: content.email,
        warnAt: EMAIL_WARN_AT,
      },
      priority: PRIORITY.digest,
      dedupeKey: `digest:${date}:${to}`,
      now,
    })
    if (result.deduped) deduped++
    else queued++
  }
  return { queued, deduped, recipients: recipients.length, emailsSent24h: content.email.sent24h }
}
