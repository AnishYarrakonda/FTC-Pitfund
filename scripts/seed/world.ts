import { hashInviteToken } from '@/lib/server/data/invites'
import { getDb } from '@/lib/server/db'
import {
  auditEvents,
  cronRuns,
  emailOutbox,
  ftcTeamCache,
  invites,
  notifications,
  pitches,
  reports,
  sponsorMembers,
  sponsors,
  teamJoinRequests,
  teamMembers,
  teams,
  type ContactSnapshot,
  type PitchStatus,
} from '@/lib/server/schema'
import { personaEmail, type PersonaKey } from '@/lib/shared/personas'
import { questionsFor } from '@/lib/shared/questions'
import { pitchSeason } from '@/lib/shared/season'

import {
  ago,
  DAY,
  HOUR,
  insertUsers,
  reconcileAuthUsers,
  uploadSponsorLogo,
  uploadTeamAssets,
  wipeAppData,
  type SeedUser,
} from './base'
import {
  answerFor,
  DECLINE_REASONS,
  PERSONA_USERS,
  PITCHES,
  REVIEW_NOTES,
  SPONSORS,
  SUMMIT_DRAFT_ANSWERS,
  TEAMS,
  type SponsorFixture,
  type TeamFixture,
} from './fixtures'
import { SEED, SEED_INVITE_TOKENS, seedPitchId, seedSponsorId, seedTeamId } from './ids'

export type World = {
  now: Date
  userIds: Map<string, string>
  personaId: (key: PersonaKey) => string
  teamIds: Map<number, string>
  sponsorIds: Map<string, string>
  pitchIds: Map<string, string>
}

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000'

function memberUser(m: TeamFixture['members'][number] | SponsorFixture['members'][number]): SeedUser | null {
  if (typeof m === 'string') return null
  return { key: m.email, email: m.email, name: m.name, jobTitle: 'jobTitle' in m ? m.jobTitle : undefined }
}

function applicantTitle(m: SponsorFixture['members'][number]) {
  if (typeof m !== 'string') return m.jobTitle ?? null
  return PERSONA_USERS.find((u) => u.email === personaEmail(m))?.jobTitle ?? null
}

function memberEmail(m: TeamFixture['members'][number] | SponsorFixture['members'][number]) {
  return typeof m === 'string' ? personaEmail(m) : m.email
}

/**
 * Build the seeded world.
 *   demo   — every table populated, every pitch status, real files.
 *   empty  — the personas and their orgs exist but have no content (first-run and empty states).
 */
export async function buildWorld(mode: 'demo' | 'empty', now = new Date()): Promise<World> {
  const db = getDb()
  const season = pitchSeason(now)

  const extraUsers = mode === 'demo'
    ? [...TEAMS.flatMap((t) => t.members), ...SPONSORS.flatMap((s) => s.members)].map(memberUser).filter((u): u is SeedUser => Boolean(u))
    : []
  const allUsers = [...PERSONA_USERS, ...extraUsers]

  console.log(`  auth users: ${allUsers.length}`)
  const userIds = await reconcileAuthUsers(allUsers)
  await wipeAppData()
  await insertUsers(allUsers, userIds, now)

  const idOf = (email: string) => userIds.get(email.toLowerCase())!
  const personaId = (key: PersonaKey) => idOf(personaEmail(key))
  const adminId = personaId('admin')

  // ─── Teams ─────────────────────────────────────────────────────────────────────────
  const teamFixtures = mode === 'demo' ? TEAMS : TEAMS.filter((t) => t.members.some((m) => m === 'coach' || m === 'coach-unverified'))
  const teamIds = new Map<number, string>()
  for (const [i, t] of teamFixtures.entries()) {
    const id = seedTeamId(t.number)
    teamIds.set(t.number, id)
    const assets =
      mode === 'demo'
        ? await uploadTeamAssets(id, t.logo === false ? null : { color: t.color, shape: t.shape }, t.pages
            ? { teamName: t.name, teamNumber: t.number, location: `${t.city}, ${t.state}`, color: t.color, pages: t.pages }
            : null)
        : null
    const createdAt = ago(now, (35 - i * 2) * DAY)
    await db.insert(teams).values({
      id,
      number: t.number,
      name: t.name,
      location: `${t.city}, ${t.state}`,
      country: t.state.length > 2 ? t.state : 'USA',
      website: mode === 'demo' ? t.website : null,
      summary: mode === 'demo' ? t.summary : null,
      logoPath: assets?.logoPath ?? null,
      logoBytes: assets?.logoBytes ?? null,
      pdfPath: assets?.pdf?.path ?? null,
      pdfPages: assets?.pdf?.pages ?? null,
      pdfBytes: assets?.pdf?.bytes ?? null,
      pdfThumbPath: assets?.pdf?.thumbPath ?? null,
      pdfThumbBytes: assets?.pdf?.thumbBytes ?? null,
      pdfUpdatedAt: assets?.pdf ? ago(now, (20 - i) * DAY) : null,
      mediaConsentAt: assets?.pdf ? ago(now, (20 - i) * DAY) : null,
      recordStatus: t.recordStatus,
      // Seeded teams are already live so the rest of the app has something to show. The review
      // queue gets its own teams below.
      status: 'approved',
      submittedAt: createdAt,
      decidedAt: mode === 'demo' ? ago(now, (30 - i * 2) * DAY) : null,
      decidedBy: mode === 'demo' ? adminId : null,
      proofPath: null,
      instagram: t.instagram ?? null,
      createdAt,
    })
    const members = mode === 'demo' ? t.members : t.members.filter((m) => typeof m === 'string')
    // The first member listed is the coach who set the team up, so they own it.
    await db.insert(teamMembers).values(
      members.map((m, j) => ({ teamId: id, userId: idOf(memberEmail(m)), role: (j === 0 ? 'owner' : 'editor') as 'owner' | 'editor', createdAt: ago(now, (34 - i * 2 - j) * DAY) })),
    )
    await db
      .insert(ftcTeamCache)
      .values({
        number: t.number,
        name: t.name,
        city: t.city,
        state: t.state,
        country: t.state.length > 2 ? t.state : 'USA',
        source: i % 3 === 0 ? 'ftcscout' : 'first',
        fetchedAt: createdAt,
      })
      .onConflictDoNothing()
  }

  // A FIRST record for a team that isn't on FTC Pitfund yet ("Is this your team?" in QA).
  await db.insert(ftcTeamCache).values({ number: 23014, name: 'Robo Ravens', city: 'Boise', state: 'ID', country: 'USA', source: 'ftcscout', fetchedAt: now })

  // ─── Sponsors ──────────────────────────────────────────────────────────────────────
  const sponsorFixtures =
    mode === 'demo' ? SPONSORS : SPONSORS.filter((s) => s.members.some((m) => m === 'sponsor' || m === 'sponsor2' || m === 'sponsor-pending'))
  const sponsorIds = new Map<string, string>()
  for (const [i, s] of sponsorFixtures.entries()) {
    const id = seedSponsorId(s.name)
    sponsorIds.set(s.name, id)
    const logo = mode === 'demo' ? await uploadSponsorLogo(id, s.color, s.shape) : null
    const decided = s.status !== 'pending'
    await db.insert(sponsors).values({
      id,
      name: s.name,
      website: s.website,
      logoPath: logo?.path ?? null,
      logoBytes: logo?.bytes ?? null,
      city: s.city,
      state: s.state,
      region: mode === 'demo' ? s.region : null,
      about: mode === 'demo' ? s.about : null,
      supportTypes: s.supportTypes,
      questions: mode === 'demo' ? s.questions : [],
      status: s.status,
      statusNote: s.statusNote ?? null,
      decidedBy: decided ? adminId : null,
      decidedAt: decided ? ago(now, (28 - i) * DAY) : null,
      applicantTitle: applicantTitle(s.members[0]),
      applicantLinkedin: i % 2 === 0 ? `https://www.linkedin.com/in/${memberEmail(s.members[0]).split('@')[0]}` : null,
      createdAt: ago(now, (32 - i) * DAY),
    })
    const members = mode === 'demo' ? s.members : s.members.filter((m) => typeof m === 'string')
    await db.insert(sponsorMembers).values(members.map((m, j) => ({ sponsorId: id, userId: idOf(memberEmail(m)), role: (j === 0 ? 'owner' : 'editor') as 'owner' | 'editor' })))
  }

  // Join request: coach-joiner waits on Exodius in both modes.
  const exodiusId = teamIds.get(31579)!
  await db.insert(teamJoinRequests).values({ teamId: exodiusId, userId: personaId('coach-joiner'), status: 'pending', createdAt: ago(now, 2 * HOUR) })

  const world: World = { now, userIds, personaId, teamIds, sponsorIds, pitchIds: new Map() }
  if (mode === 'empty') return world

  // ─── Pitches ───────────────────────────────────────────────────────────────────────
  const teamByNumber = new Map(TEAMS.map((t) => [t.number, t]))
  const sponsorByName = new Map(SPONSORS.map((s) => [s.name, s]))
  const auditRows: Array<typeof auditEvents.$inferInsert> = []
  const notificationRows: Array<typeof notifications.$inferInsert> = []

  for (const [i, [teamNumber, sponsorName, status]] of PITCHES.entries()) {
    const team = teamByNumber.get(teamNumber)!
    const company = sponsorByName.get(sponsorName)!
    const teamId = teamIds.get(teamNumber)!
    const sponsorId = sponsorIds.get(sponsorName)!
    const coachEmail = memberEmail(team.members[0])
    const coachId = idOf(coachEmail)
    const sponsorMemberEmail = memberEmail(company.members[0])
    const sponsorMemberId = idOf(sponsorMemberEmail)
    const id = seedPitchId(teamNumber, sponsorName)
    world.pitchIds.set(`${teamNumber}:${sponsorName}`, id)

    // Tidal → Harbor Point was submitted a few hours ago, so the queue shows a pitch that isn't late.
    const base = teamNumber === 14398 && status === 'in_review' ? ago(now, 5 * HOUR) : ago(now, (26 - (i % 20)) * DAY + i * HOUR)
    const step = (n: number) => new Date(base.getTime() + n * 7 * HOUR)
    const reached = (s: PitchStatus[]) => s.includes(status)
    const submitted = !reached(['draft'])
    const withdrawnAfterSending = status === 'withdrawn' && (i % 2 === 0 || sponsorName === 'Brightline Engineering')
    const reviewed = reached(['changes_requested', 'rejected', 'sent', 'matched', 'declined']) || withdrawnAfterSending
    const sent = reached(['sent', 'matched', 'declined']) || withdrawnAfterSending
    const responded = reached(['matched', 'declined'])

    const questions = questionsFor({ name: company.name, questions: company.questions })
    const fullAnswers = questions.map((qn, qi) => ({ questionId: qn.id, prompt: qn.prompt, answer: answerFor(qn.id, team, company.name, i + qi) }))
    // Drafts are half-written: only the first answer is filled in.
    const answers =
      status !== 'draft'
        ? fullAnswers
        : teamNumber === 31579 && sponsorName === 'Summit Fabrication'
          ? SUMMIT_DRAFT_ANSWERS
          : fullAnswers.map((a, qi) => (qi === 0 ? a : { ...a, answer: '' }))
    const askType = (['amount', 'in_kind', 'open', 'none'] as const)[i % 4]

    const coachUser = PERSONA_USERS.find((u) => u.email === coachEmail)
    const sponsorUser = PERSONA_USERS.find((u) => u.email === sponsorMemberEmail)
    const teamContact: ContactSnapshot = {
      name: coachUser?.name ?? (team.members[0] as { name: string }).name,
      email: coachEmail,
      phone: coachUser?.phone ?? null,
      teamUrl: `${APP_URL}/t/${teamNumber}`,
      teamName: team.name,
      teamNumber,
    }
    const sponsorContact: ContactSnapshot = {
      name: sponsorUser?.name ?? (company.members[0] as { name: string }).name,
      email: sponsorMemberEmail,
      phone: sponsorUser?.phone ?? null,
      jobTitle: sponsorUser?.jobTitle ?? (company.members[0] as { jobTitle?: string }).jobTitle ?? null,
      companyName: company.name,
      website: company.website,
    }

    await getDb().insert(pitches).values({
      id,
      teamId,
      sponsorId,
      season,
      status,
      answers,
      askType,
      askAmountCents: askType === 'amount' ? (1500 + (i % 5) * 500) * 100 : null,
      askNote: askType === 'in_kind' ? 'Machining time for drivetrain plates, or a set of goBILDA motors.' : askType === 'open' ? 'Happy to talk through whatever fits your program.' : null,
      createdBy: coachId,
      submittedBy: submitted ? coachId : null,
      submittedAt: submitted ? step(1) : null,
      reviewNote: status === 'changes_requested' ? REVIEW_NOTES.changes_requested : status === 'rejected' ? REVIEW_NOTES.rejected : null,
      reviewedBy: reviewed ? adminId : null,
      reviewedAt: reviewed ? step(2) : null,
      sentAt: sent ? step(2) : null,
      respondedBy: responded ? sponsorMemberId : null,
      respondedAt: responded ? step(4) : null,
      declineReason: status === 'declined' ? DECLINE_REASONS[i % DECLINE_REASONS.length] : null,
      teamContact: status === 'matched' ? teamContact : null,
      sponsorContact: status === 'matched' ? sponsorContact : null,
      createdAt: step(0),
      updatedAt: step(responded ? 4 : sent ? 2 : submitted ? 1 : 0),
    })

    const ev = (n: number, action: string, actorId: string | null, data: Record<string, unknown> = {}) =>
      auditRows.push({ actorId, action, entityType: 'pitch', entityId: id, data, createdAt: step(n) })
    ev(0, 'pitch.created', coachId)
    if (submitted) ev(1, 'pitch.submitted', coachId)
    if (status === 'changes_requested') ev(2, 'pitch.sent_back', adminId, { note: REVIEW_NOTES.changes_requested })
    if (status === 'rejected') ev(2, 'pitch.rejected', adminId, { note: REVIEW_NOTES.rejected })
    if (sent) ev(2, 'pitch.approved', adminId)
    if (status === 'matched') ev(4, 'pitch.matched', sponsorMemberId)
    if (status === 'declined') ev(4, 'pitch.declined', sponsorMemberId)
    if (status === 'withdrawn') ev(3, 'pitch.withdrawn', coachId, { from: sent ? 'sent' : 'in_review' })

    // In-app notifications for the people involved.
    const href = `/pitches/${id}`
    if (status === 'matched') {
      notificationRows.push({ userId: coachId, type: 'pitch.matched', title: `${company.name} is interested`, body: `You're connected with ${sponsorContact.name}. Their contact details are on the pitch.`, href, createdAt: step(4), readAt: i % 2 ? null : step(5) })
      notificationRows.push({ userId: sponsorMemberId, type: 'pitch.matched', title: `You're connected with ${team.name}`, body: `${teamContact.name} will hear from you.`, href: `/inbox/${id}`, createdAt: step(4), readAt: step(4) })
    }
    if (status === 'sent') {
      for (const m of company.members) {
        notificationRows.push({ userId: idOf(memberEmail(m)), type: 'pitch.received', title: `New pitch from ${team.name}`, body: `Team ${team.number} · ${team.city}, ${team.state}`, href: `/inbox/${id}`, createdAt: step(2), readAt: null })
      }
      notificationRows.push({ userId: coachId, type: 'pitch.approved', title: `Your pitch to ${company.name} was sent`, body: 'A reviewer approved it. The company can see it now.', href, createdAt: step(2), readAt: step(3) })
    }
    if (status === 'changes_requested') notificationRows.push({ userId: coachId, type: 'pitch.sent_back', title: `Changes requested on your pitch to ${company.name}`, body: REVIEW_NOTES.changes_requested, href, createdAt: step(2), readAt: null })
    if (status === 'declined') notificationRows.push({ userId: coachId, type: 'pitch.declined', title: `${company.name} isn't a fit this time`, body: DECLINE_REASONS[i % DECLINE_REASONS.length], href, createdAt: step(4), readAt: null })
    if (status === 'in_review') notificationRows.push({ userId: adminId, type: 'pitch.submitted', title: `${team.name} pitched ${company.name}`, body: 'Waiting for review.', href: `/admin/pitches/${id}`, createdAt: step(1), readAt: null })
  }

  await db.insert(auditEvents).values(auditRows)
  await db.insert(notifications).values(notificationRows)

  // ─── Memberships, invites, reports ─────────────────────────────────────────────────
  const gearId = teamIds.get(16072)!
  await db.insert(teamJoinRequests).values([
    { teamId: gearId, userId: idOf('member-gear2@pitfund.test'), status: 'approved', decidedBy: idOf('member-gear@pitfund.test'), decidedAt: ago(now, 20 * DAY), createdAt: ago(now, 21 * DAY) },
    { teamId: teamIds.get(22761)!, userId: personaId('coach-new'), status: 'declined', decidedBy: idOf('member-knights@pitfund.test'), decidedAt: ago(now, 6 * DAY), createdAt: ago(now, 7 * DAY) },
  ])
  notificationRows.length = 0
  await db.insert(notifications).values({ userId: personaId('coach'), type: 'team.join_request', title: 'Sam Patel wants to join Exodius', body: 'coach-joiner@pitfund.test', href: '/team', createdAt: ago(now, 2 * HOUR) })

  const brightlineId = sponsorIds.get('Brightline Engineering')!
  await db.insert(invites).values([
    { kind: 'team', teamId: exodiusId, email: personaEmail('coach-new'), tokenHash: hashInviteToken(SEED_INVITE_TOKENS.valid), invitedBy: personaId('coach'), expiresAt: new Date(now.getTime() + 10 * DAY), createdAt: ago(now, 4 * DAY) },
    { kind: 'team', teamId: exodiusId, email: 'old.invite@pitfund.test', tokenHash: hashInviteToken(SEED_INVITE_TOKENS.expired), invitedBy: personaId('coach'), expiresAt: ago(now, 2 * DAY), createdAt: ago(now, 16 * DAY) },
    { kind: 'team', teamId: exodiusId, email: 'revoked.invite@pitfund.test', tokenHash: hashInviteToken(SEED_INVITE_TOKENS.revoked), invitedBy: personaId('coach'), expiresAt: new Date(now.getTime() + 5 * DAY), revokedAt: ago(now, 1 * DAY), createdAt: ago(now, 9 * DAY) },
    { kind: 'sponsor', sponsorId: brightlineId, email: 'member-brightline@pitfund.test', tokenHash: hashInviteToken(SEED_INVITE_TOKENS.used), invitedBy: personaId('sponsor'), expiresAt: ago(now, 10 * DAY), acceptedAt: ago(now, 22 * DAY), createdAt: ago(now, 23 * DAY) },
    { kind: 'sponsor', sponsorId: brightlineId, email: 'finance@pitfund.test', tokenHash: hashInviteToken(SEED_INVITE_TOKENS.sponsorValid), invitedBy: personaId('sponsor'), expiresAt: new Date(now.getTime() + 12 * DAY), createdAt: ago(now, 2 * DAY) },
  ])

  await db.insert(reports).values([
    { id: SEED.reports.tidal, teamId: teamIds.get(14398)!, reporterEmail: 'concerned.parent@pitfund.test', reason: 'impersonation', details: 'I could not find this team in FIRST records for this season.', createdAt: ago(now, 3 * DAY) },
    { id: SEED.reports.quokkas, teamId: teamIds.get(18215)!, reporterUserId: personaId('sponsor'), reason: 'spam', details: 'The team sent the same generic pitch text to several companies, word for word.', createdAt: ago(now, 7 * HOUR) },
    { teamId: teamIds.get(18215)!, reporterUserId: personaId('sponsor'), reason: 'inappropriate', details: 'The deck included a photo that looked like it was used without permission.', status: 'resolved', resolvedBy: adminId, resolvedAt: ago(now, 5 * DAY), createdAt: ago(now, 6 * DAY) },
  ])

  // ─── Email outbox and cron ─────────────────────────────────────────────────────────
  const notice = (title: string) => ({ subject: title, title, paragraphs: ['Open FTC Pitfund to see the details.'], cta: { label: 'Open FTC Pitfund', href: APP_URL } })
  const outbox: Array<typeof emailOutbox.$inferInsert> = []
  for (let i = 0; i < 12; i++) {
    const sentAt = ago(now, (20 - i) * HOUR)
    outbox.push({ toEmail: personaEmail(i % 2 ? 'coach' : 'sponsor'), template: 'notice', payload: notice(i % 2 ? 'Your pitch was sent' : 'New pitch from Exodius'), priority: 1, status: 'sent', attempts: 1, resendId: `seed-${i}`, sentAt, sendAfter: sentAt, createdAt: sentAt })
  }
  outbox.push({ toEmail: personaEmail('admin'), template: 'notice', payload: notice('Daily summary: 2 new teams, 1 new company'), priority: 3, status: 'queued', sendAfter: new Date(now.getTime() + 14 * HOUR), createdAt: ago(now, 1 * HOUR) })
  outbox.push({ toEmail: personaEmail('coach-unverified'), template: 'notice', payload: notice('Your pitch to Cedar Valley Credit Union is in review'), priority: 1, status: 'queued', sendAfter: new Date(now.getTime() + 3 * HOUR), attempts: 2, lastError: 'rate_limit_exceeded: Too many requests', createdAt: ago(now, 30 * 60 * 1000) })
  outbox.push({ toEmail: 'member-tidal@pitfund.test', template: 'notice', payload: notice('Welcome to FTC Pitfund'), priority: 1, status: 'failed', attempts: 5, lastError: 'validation_error: The to address is invalid', createdAt: ago(now, 5 * HOUR), updatedAt: ago(now, 4 * HOUR) })
  outbox.push({ toEmail: 'old-address@pitfund.test', template: 'notice', payload: notice('New pitch from Quantum Quokkas'), priority: 1, status: 'bounced', attempts: 1, resendId: 'seed-bounced', sentAt: ago(now, 9 * HOUR), sendAfter: ago(now, 9 * HOUR), lastError: 'bounced: Mailbox does not exist', createdAt: ago(now, 9 * HOUR), updatedAt: ago(now, 8 * HOUR) })
  await db.insert(emailOutbox).values(outbox)

  await db.insert(cronRuns).values(cronHistory(now, { lastRunHoursAgo: 20 }))

  return world
}

const CRON_JOBS = ['drain-outbox', 'admin-digest', 'clean-staging', 'recheck-records', 'keepalive'] as const

/**
 * Three days of daily-cron history, one row per job per run. `lastRunHoursAgo` over 36 makes System
 * warn that the job is stale (edge). The run two days ago had a failed record check.
 */
export function cronHistory(now: Date, { lastRunHoursAgo }: { lastRunHoursAgo: number }): Array<typeof cronRuns.$inferInsert> {
  const rows: Array<typeof cronRuns.$inferInsert> = []
  for (let day = 0; day < 3; day++) {
    const started = ago(now, (lastRunHoursAgo + day * 24) * HOUR)
    for (const [j, job] of CRON_JOBS.entries()) {
      const at = new Date(started.getTime() + j * 1500)
      const failed = day === 1 && job === 'recheck-records'
      const result = {
        'drain-outbox': { claimed: 4 - day, sent: 4 - day, deferred: 0, retried: 0, failed: 0 },
        'admin-digest': { skipped: false, queued: 1, deduped: 0, sent: 1 },
        'clean-staging': { deleted: day },
        'recheck-records': { checked: 1, matched: 0, not_found: 0, unavailable: 1 },
        keepalive: { result: 1 },
      }[job]
      rows.push({
        job,
        startedAt: at,
        finishedAt: new Date(at.getTime() + 900),
        ok: !failed,
        detail: failed ? { error: 'FTCScout responded 503', reference: 'seed0000cron' } : { result },
      })
    }
  }
  return rows
}
