import { and, eq, inArray, like } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import type { TeamViewer } from '@/lib/server/authz'
import { requireTeamMember } from '@/lib/server/authz'
import {
  approveCompany,
  deleteCompany,
  deleteTeam,
  recheckTeamRecord,
  rejectCompany,
  resolveReport,
  setAdmin,
  setUserSuspended,
  suspendCompany,
  suspendTeam,
  unsuspendCompany,
  unsuspendTeam,
  approveTeam,
  rejectTeam,
} from '@/lib/server/data/admin-orgs'
import { approvalBlocker, approvePitch, getPitchReview, listPitchQueue, nextInQueue, rejectPitch, reviewCounts, sendBackPitch } from '@/lib/server/data/admin-review'
import { searchPeople, searchTeams } from '@/lib/server/data/admin-directory'
import { queryDirectorySponsor } from '@/lib/server/data/directory'
import { startPitch } from '@/lib/server/data/pitches'
import { queryPublicTeam } from '@/lib/server/data/public-team'
import { getDb } from '@/lib/server/db'
import { buildDigest, DIGEST_RECIPIENTS, EMAIL_WARN_AT, enqueueAdminDigest } from '@/lib/server/digest'
import { renderEmail } from '@/lib/server/email/templates'
import type { EmailTransport } from '@/lib/server/email/send'
import { runDailyCron } from '@/lib/server/jobs'
import { auditEvents, cronRuns, emailOutbox, pitches, reports, sponsors, teams, users, type PitchStatus } from '@/lib/server/schema'
import { dismissEmail, getSystemStatus, requeueEmail } from '@/lib/server/data/system'
import { loadViewer } from '@/lib/server/viewer'

import { addSponsorMember, addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'
import { expectAppError } from './helpers/errors'

/*
 * The admin console (prompt 3, scope D) and the daily cron (scope F): pitch decisions and their
 * conflicts, company and team state changes with their side effects, people, the digest and cron
 * idempotency. Tests pass `now` instead of mocking the clock.
 */

const NOW = new Date('2026-10-05T14:00:00Z')

async function adminViewer(name = 'Avery Admin') {
  const user = await createUser({ isAdmin: true, name })
  return (await loadViewer(user.id))!
}

async function inReviewPitch(options: { companyStatus?: 'approved' | 'pending' | 'suspended'; submittedAt?: Date; status?: PitchStatus } = {}) {
  const team = await createTeam()
  const coach = await createUser()
  await addTeamMember(team.id, coach.id)
  const company = await createSponsor({ status: options.companyStatus ?? 'approved' })
  const reps = [await createUser(), await createUser()]
  for (const r of reps) await addSponsorMember(company.id, r.id)
  const [pitch] = await getDb()
    .insert(pitches)
    .values({ teamId: team.id, sponsorId: company.id, season: 2026, status: options.status ?? 'in_review', createdBy: coach.id, submittedBy: coach.id, submittedAt: options.submittedAt ?? new Date(NOW.getTime() - 30 * 3600_000) })
    .returning()
  return { team, coach, company, reps, pitch }
}

const statusOf = async (id: string) => (await getDb().select({ status: pitches.status }).from(pitches).where(eq(pitches.id, id)))[0]?.status

describe('pitch review decisions', () => {
  it(
    'Approve & send moves in_review → sent, records the reviewer and returns every company member',
    dbTest(async () => {
      const admin = await adminViewer()
      const { pitch, reps, coach } = await inReviewPitch()
      const result = await approvePitch(admin, pitch.id, NOW)
      expect(result.pitch).toMatchObject({ status: 'sent', sentAt: NOW, reviewedBy: admin.id, reviewedAt: NOW, reviewNote: null })
      expect(result.members.map((m) => m.id).sort()).toEqual(reps.map((r) => r.id).sort())
      expect(result.coach?.id).toBe(coach.id)
      const events = await getDb().select().from(auditEvents).where(and(eq(auditEvents.entityId, pitch.id), eq(auditEvents.action, 'pitch.approved')))
      expect(events).toHaveLength(1)
    }),
  )

  it(
    'Send back stores the note; Reject takes an optional note',
    dbTest(async () => {
      const admin = await adminViewer()
      const a = await inReviewPitch()
      expect((await sendBackPitch(admin, a.pitch.id, 'Name the parts.', NOW)).pitch).toMatchObject({ status: 'changes_requested', reviewNote: 'Name the parts.' })
      const b = await inReviewPitch()
      expect((await rejectPitch(admin, b.pitch.id, null, NOW)).pitch).toMatchObject({ status: 'rejected', reviewNote: null })
      const [event] = await getDb().select().from(auditEvents).where(and(eq(auditEvents.entityId, a.pitch.id), eq(auditEvents.action, 'pitch.sent_back')))
      expect(event.data).toEqual({ note: 'Name the parts.' })
    }),
  )

  it(
    'a second decision is a conflict that names who decided, and nothing changes',
    dbTest(async () => {
      const first = await adminViewer('Jordan First')
      const second = await adminViewer('Sam Second')
      const { pitch } = await inReviewPitch()
      await approvePitch(first, pitch.id, NOW)
      await expectAppError(approvePitch(second, pitch.id, NOW), 'CONFLICT', { message: 'Jordan First already approved this pitch.' })
      await expectAppError(sendBackPitch(second, pitch.id, 'x', NOW), 'CONFLICT', { message: 'Jordan First already approved this pitch.' })
      await expectAppError(rejectPitch(second, pitch.id, null, NOW), 'CONFLICT')
      expect(await statusOf(pitch.id)).toBe('sent')

      const other = await inReviewPitch()
      await sendBackPitch(first, other.pitch.id, 'Fix it', NOW)
      await expectAppError(approvePitch(second, other.pitch.id, NOW), 'CONFLICT', { message: 'Jordan First already sent back this pitch.' })
    }),
  )

  it(
    'a rejected or not-a-fit pitch still uses the team’s one pitch to that company this season',
    dbTest(async () => {
      const admin = await adminViewer()
      for (const outcome of ['rejected', 'declined'] as const) {
        const { pitch, coach, company } = await inReviewPitch({ submittedAt: new Date('2026-09-20T12:00:00Z') })
        if (outcome === 'rejected') await rejectPitch(admin, pitch.id, null, NOW)
        else await getDb().update(pitches).set({ status: 'declined' }).where(eq(pitches.id, pitch.id))
        const viewer = (await loadViewer(coach.id)) as TeamViewer
        await expectAppError(startPitch(viewer, company.id, NOW), 'CONFLICT', { href: `/pitches/${pitch.id}` })
      }
    }),
  )

  it(
    'illegal starting states are refused: drafts, withdrawn and unknown pitches',
    dbTest(async () => {
      const admin = await adminViewer()
      const draft = await inReviewPitch({ status: 'draft' })
      await expectAppError(approvePitch(admin, draft.pitch.id, NOW), 'CONFLICT')
      const withdrawn = await inReviewPitch({ status: 'withdrawn' })
      await expectAppError(approvePitch(admin, withdrawn.pitch.id, NOW), 'CONFLICT', { message: `Team ${withdrawn.team.number} withdrew this pitch.` })
      await expectAppError(approvePitch(admin, crypto.randomUUID(), NOW), 'NOT_FOUND')
    }),
  )

  it(
    'approval is blocked while the company isn’t approved or the team is suspended; send back still works',
    dbTest(async () => {
      const admin = await adminViewer()
      const suspendedCo = await inReviewPitch({ companyStatus: 'suspended' })
      await expectAppError(approvePitch(admin, suspendedCo.pitch.id, NOW), 'CONFLICT', { message: `${suspendedCo.company.name} is suspended, so it can’t receive pitches.` })
      expect((await getPitchReview(admin, suspendedCo.pitch.id)).approvalBlocker).toMatch(/is suspended/)
      expect(await statusOf(suspendedCo.pitch.id)).toBe('in_review')
      await sendBackPitch(admin, suspendedCo.pitch.id, 'Pick another company', NOW)

      const suspendedTeam = await inReviewPitch()
      await getDb().update(teams).set({ suspendedAt: NOW }).where(eq(teams.id, suspendedTeam.team.id))
      await expectAppError(approvePitch(admin, suspendedTeam.pitch.id, NOW), 'CONFLICT', { message: `Team ${suspendedTeam.team.number} is suspended, so its pitches can’t be sent.` })
      expect(approvalBlocker({ number: 1, suspended: false }, { name: 'Acme', status: 'pending' })).toBe('Acme isn’t approved yet, so it can’t receive pitches.')
      expect(approvalBlocker({ number: 1, suspended: false }, { name: 'Acme', status: 'approved' })).toBeNull()
    }),
  )

  it(
    'the queue is oldest first, with counts, neighbours and auto-advance that wraps',
    dbTest(async () => {
      const admin = await adminViewer()
      await getDb().update(pitches).set({ status: 'draft' }).where(eq(pitches.status, 'in_review'))
      const oldest = await inReviewPitch({ submittedAt: new Date(NOW.getTime() - 50 * 3600_000) })
      const middle = await inReviewPitch({ submittedAt: new Date(NOW.getTime() - 20 * 3600_000) })
      const newest = await inReviewPitch({ submittedAt: new Date(NOW.getTime() - 1 * 3600_000) })
      const queue = await listPitchQueue({ after: null, before: null })
      expect(queue.items.map((p) => p.id)).toEqual([oldest.pitch.id, middle.pitch.id, newest.pitch.id])
      expect((await reviewCounts()).pitches).toBe(3)

      const review = await getPitchReview(admin, middle.pitch.id)
      expect(review.queue).toEqual({ position: 2, total: 3, previousId: oldest.pitch.id, nextId: newest.pitch.id })
      await approvePitch(admin, middle.pitch.id, NOW)
      expect(await nextInQueue(middle.pitch.id)).toBe(newest.pitch.id)
      await approvePitch(admin, newest.pitch.id, NOW)
      expect(await nextInQueue(newest.pitch.id)).toBe(oldest.pitch.id)
      await approvePitch(admin, oldest.pitch.id, NOW)
      expect(await nextInQueue(oldest.pitch.id)).toBeNull()
    }),
  )
})

describe('company decisions', () => {
  it(
    'approve (from pending or rejected), reject with a note, suspend and unsuspend, each once',
    dbTest(async () => {
      const admin = await adminViewer()
      const company = await createSponsor({ status: 'pending' })
      const member = await createUser()
      await addSponsorMember(company.id, member.id)

      await expectAppError(unsuspendCompany(admin, company.id, NOW), 'CONFLICT')
      const rejected = await rejectCompany(admin, company.id, 'Couldn’t verify.', NOW)
      expect(rejected.company.status).toBe('rejected')
      expect(rejected.members.map((m) => m.id)).toEqual([member.id])
      await expectAppError(rejectCompany(admin, company.id, 'again', NOW), 'CONFLICT')

      const approved = await approveCompany(admin, company.id, NOW)
      expect(approved.company.status).toBe('approved')
      expect(await queryDirectorySponsor(company.id)).not.toBeNull()
      const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, company.id))
      expect(row).toMatchObject({ decidedBy: admin.id, statusNote: null })
      await expectAppError(approveCompany(admin, company.id, NOW), 'CONFLICT')

      await suspendCompany(admin, company.id, NOW)
      expect(await queryDirectorySponsor(company.id)).toBeNull()
      expect((await loadViewer(member.id))?.sponsor?.status).toBe('suspended')
      await unsuspendCompany(admin, company.id, NOW)
      expect(await queryDirectorySponsor(company.id)).not.toBeNull()

      const actions = (await getDb().select({ action: auditEvents.action }).from(auditEvents).where(eq(auditEvents.entityId, company.id))).map((e) => e.action)
      expect(actions).toEqual(expect.arrayContaining(['sponsor.rejected', 'sponsor.approved', 'sponsor.suspended', 'sponsor.unsuspended']))
    }),
  )

  it(
    'deleting needs the exact name and returns the storage objects to clean up',
    dbTest(async () => {
      const admin = await adminViewer()
      const company = await createSponsor({ name: 'Delete Me Co', logoPath: 'sponsors/x/logo.webp' })
      await expectAppError(deleteCompany(admin, company.id, 'Delete Me'), 'VALIDATION', { field: 'confirmName' })
      expect((await deleteCompany(admin, company.id, ' delete me co ')).objects).toEqual(['sponsors/x/logo.webp'])
      expect(await getDb().select().from(sponsors).where(eq(sponsors.id, company.id))).toEqual([])
      const team = await createTeam({ name: 'Gone Robotics', logoPath: 'teams/x/logo.webp', pdfPath: 'teams/x/deck.pdf', pdfThumbPath: 'teams/x/thumb.webp' })
      expect((await deleteTeam(admin, team.id, 'Gone Robotics')).objects).toEqual(['teams/x/logo.webp', 'teams/x/deck.pdf', 'teams/x/thumb.webp'])
    }),
  )
})

describe('team decisions', () => {
  it(
    'approve and reject are one-shot transitions, and only an approved team has a public page',
    dbTest(async () => {
      const admin = await adminViewer()
      const team = await createTeam({ status: 'pending', proofPath: 'teams/x/proof-1.webp', proofBytes: 4096, proofUploadedAt: NOW })
      // A team waiting for review must not already be reachable at its own number: that is what
      // stops someone claiming a team number and getting a page with that team on it.
      expect(await queryPublicTeam(team.number)).toBeNull()

      const decision = await approveTeam(admin, team.id, NOW)
      await expectAppError(approveTeam(admin, team.id, NOW), 'CONFLICT')
      expect((await queryPublicTeam(team.number))?.verified).toBe(true)

      // The upload page promises the screenshot is deleted once the team is approved: the row is
      // cleared here and the object itself is handed back for the action to remove.
      expect(decision.proofPath).toBe('teams/x/proof-1.webp')
      const [after] = await getDb().select({ proofPath: teams.proofPath, proofBytes: teams.proofBytes }).from(teams).where(eq(teams.id, team.id))
      expect(after).toMatchObject({ proofPath: null, proofBytes: null })

      // Rejecting only applies to a team still waiting, so a second admin can't undo an approval
      // by racing it.
      await expectAppError(rejectTeam(admin, team.id, 'No', NOW), 'CONFLICT')
    }),
  )

  it(
    'a rejected team keeps the note, loses its page, and can be approved after fixing things',
    dbTest(async () => {
      const admin = await adminViewer()
      const team = await createTeam({ status: 'pending' })
      const { team: rejected } = await rejectTeam(admin, team.id, 'The screenshot doesn’t show your name.', NOW)
      expect(rejected.status).toBe('rejected')
      expect(await queryPublicTeam(team.number)).toBeNull()

      const { team: approved } = await approveTeam(admin, team.id, NOW)
      expect(approved.status).toBe('approved')
      expect((await queryPublicTeam(team.number))?.verified).toBe(true)
    }),
  )

  it(
    'suspending hides the public page, blocks the coaches and withdraws only pitches in review',
    dbTest(async () => {
      const admin = await adminViewer()
      const { team, coach, pitch } = await inReviewPitch()
      const company = await createSponsor()
      const [sent] = await getDb().insert(pitches).values({ teamId: team.id, sponsorId: company.id, season: 2026, status: 'sent' }).returning()

      const result = await suspendTeam(admin, team.id, NOW)
      expect(result.withdrawn.map((p) => p.id)).toEqual([pitch.id])
      expect(await statusOf(pitch.id)).toBe('withdrawn')
      expect(await statusOf(sent.id)).toBe('sent')
      expect(await queryPublicTeam(team.number)).toBeNull()
      await expectAppError(requireTeamMember({ viewer: (await loadViewer(coach.id)) as TeamViewer }), 'FORBIDDEN')
      const [event] = await getDb().select().from(auditEvents).where(and(eq(auditEvents.entityId, pitch.id), eq(auditEvents.action, 'pitch.withdrawn')))
      expect(event.data).toEqual({ from: 'in_review', reason: 'team_suspended' })
      await expectAppError(suspendTeam(admin, team.id, NOW), 'CONFLICT')

      await unsuspendTeam(admin, team.id)
      expect(await queryPublicTeam(team.number)).not.toBeNull()
    }),
  )

  it(
    're-checking FIRST records matches, marks not found, or leaves an outage unchecked',
    dbTest(async () => {
      const team = await createTeam({ recordStatus: 'unchecked', number: 900_000 + Math.floor(Math.random() * 90_000) })
      const found: typeof fetch = async () => Response.json({ data: { teamByNumber: { number: team.number, name: 'Found Bots', location: { city: 'Austin', state: 'TX', country: 'USA' } } } })
      const missing: typeof fetch = async () => Response.json({ data: { teamByNumber: null } })
      const down: typeof fetch = async () => new Response('nope', { status: 503 })
      expect((await recheckTeamRecord(null, team.id, { fetch: down, firstCredentials: null })).outcome).toBe('unavailable')
      expect((await getDb().select().from(teams).where(eq(teams.id, team.id)))[0].recordStatus).toBe('unchecked')
      expect((await recheckTeamRecord(null, team.id, { fetch: missing, firstCredentials: null })).outcome).toBe('not_found')
      expect((await getDb().select().from(teams).where(eq(teams.id, team.id)))[0].recordStatus).toBe('manual')
      expect((await recheckTeamRecord(null, team.id, { fetch: found, firstCredentials: null })).outcome).toBe('matched')
      expect((await getDb().select().from(teams).where(eq(teams.id, team.id)))[0].recordStatus).toBe('matched')
    }),
  )

  it(
    'a report resolves once',
    dbTest(async () => {
      const admin = await adminViewer()
      const team = await createTeam()
      const [report] = await getDb().insert(reports).values({ teamId: team.id, reason: 'spam' }).returning()
      await resolveReport(admin, report.id, NOW)
      await expectAppError(resolveReport(admin, report.id, NOW), 'CONFLICT')
      await expectAppError(resolveReport(admin, crypto.randomUUID(), NOW), 'NOT_FOUND')
    }),
  )
})

describe('people', () => {
  it(
    'admins grant and revoke admin but never revoke or suspend themselves',
    dbTest(async () => {
      const admin = await adminViewer()
      const person = await createUser({ email: `person-${crypto.randomUUID()}@pitfund.test`, name: 'Pat Person' })
      await expectAppError(setAdmin(admin, admin.id, false), 'FORBIDDEN')
      await expectAppError(setUserSuspended(admin, admin.id, true, NOW), 'FORBIDDEN')
      await setAdmin(admin, person.id, true)
      await expectAppError(setAdmin(admin, person.id, true), 'CONFLICT')
      await setUserSuspended(admin, person.id, true, NOW)
      expect((await getDb().select().from(users).where(eq(users.id, person.id)))[0]).toMatchObject({ isAdmin: true, suspendedAt: NOW })
      expect((await searchPeople(person.email, { after: null, before: null })).items[0]).toMatchObject({ id: person.id, isAdmin: true, suspended: true })
    }),
  )

  it(
    'the directory searches teams by name or number with cursor pages',
    dbTest(async () => {
      const team = await createTeam({ name: 'Cursor Search Robotics' })
      expect((await searchTeams(String(team.number), { after: null, before: null })).items.map((t) => t.id)).toEqual([team.id])
      expect((await searchTeams('cursor search', { after: null, before: null })).items.map((t) => t.id)).toContain(team.id)
      const first = await searchTeams('', { after: null, before: null })
      expect(first.items).toHaveLength(Math.min(25, first.items.length))
      if (first.nextCursor) {
        const second = await searchTeams('', { after: first.nextCursor, before: null })
        expect(second.items[0].number).toBeGreaterThan(first.items[first.items.length - 1].number)
        expect(second.prevCursor).not.toBeNull()
      }
    }),
  )
})

describe('the daily summary', () => {
  it(
    'is built on a quiet day too, and lists what is waiting',
    dbTest(async () => {
      await getDb().update(pitches).set({ status: 'draft' }).where(eq(pitches.status, 'in_review'))
      await getDb().update(sponsors).set({ status: 'approved' }).where(eq(sponsors.status, 'pending'))
      await getDb().update(reports).set({ status: 'resolved' }).where(eq(reports.status, 'open'))
      await getDb().update(teams).set({ status: 'approved' }).where(eq(teams.status, 'pending'))
      await getDb().update(teams).set({ createdAt: new Date(NOW.getTime() - 5 * 86400_000) })
      const quiet = await buildDigest(NOW)
      expect(quiet).toMatchObject({ waitingPitches: 0, pendingCompaniesTotal: 0, newTeamsTotal: 0, openReports: 0 })

      const late = await inReviewPitch({ submittedAt: new Date(NOW.getTime() - 30 * 3600_000) })
      await inReviewPitch({ submittedAt: new Date(NOW.getTime() - 2 * 3600_000) })
      const pending = await createSponsor({ status: 'pending', name: 'Waiting Co' })
      const newTeam = await createTeam({ name: 'Brand New Bots', status: 'pending', createdAt: new Date(NOW.getTime() - 3600_000) })
      await getDb().update(teams).set({ status: 'approved' }).where(inArray(teams.id, [late.team.id]))
      const digest = await buildDigest(NOW)
      expect(digest).toMatchObject({ waitingPitches: 1, oldestWaitingHours: 30, pendingCompaniesTotal: 1, openReports: 0 })
      expect(digest.pendingCompanies.map((c) => c.id)).toEqual([pending.id])
      expect(digest.newTeams.map((t) => t.id)).toContain(newTeam.id)
    }),
  )

  it(
    'counts the emails sent in the last 24 hours, this month, and the ones that went wrong',
    dbTest(async () => {
      const before = await buildDigest(NOW)
      const row = (template: string, patch: Partial<typeof emailOutbox.$inferInsert>) => ({ toEmail: 'x@pitfund.test', template, priority: 1 as const, ...patch })
      await getDb()
        .insert(emailOutbox)
        .values([
          row('login-code', { status: 'sent', sentAt: new Date(NOW.getTime() - 3600_000) }),
          row('login-code', { status: 'sent', sentAt: new Date(NOW.getTime() - 5 * 3600_000) }),
          row('pitch-approved-coach', { status: 'sent', sentAt: new Date(NOW.getTime() - 23 * 3600_000) }),
          // Sent earlier this month, outside the 24 h window.
          row('pitch-approved-coach', { status: 'sent', sentAt: new Date(NOW.getTime() - 3 * 86400_000) }),
          row('notice', { status: 'failed', updatedAt: new Date(NOW.getTime() - 2 * 3600_000) }),
          row('notice', { status: 'bounced', updatedAt: new Date(NOW.getTime() - 4 * 3600_000) }),
          row('notice', { status: 'queued' }),
        ])
      const after = await buildDigest(NOW)
      expect(after.email.sent24h - before.email.sent24h).toBe(3)
      expect(after.email.sentThisMonth - before.email.sentThisMonth).toBe(4)
      expect(after.email.failed24h - before.email.failed24h).toBe(1)
      expect(after.email.bounced24h - before.email.bounced24h).toBe(1)
      expect(after.email.waiting - before.email.waiting).toBe(1)
      expect(after.email.limit).toBe(100)
      expect(after.email.byKind.find((k) => k.label === 'login code')?.count).toBeGreaterThanOrEqual(2)
    }),
  )

  it(
    'is queued once per recipient per day, admins and the fixed addresses alike, however often it runs',
    dbTest(async () => {
      const admins = await getDb().select({ email: users.email }).from(users).where(eq(users.isAdmin, true))
      const expected = new Set([...DIGEST_RECIPIENTS, ...admins.map((a) => a.email)].map((e) => e.toLowerCase())).size
      const first = await enqueueAdminDigest(NOW)
      const second = await enqueueAdminDigest(new Date(NOW.getTime() + 3600_000))
      expect(first).toMatchObject({ queued: expected, deduped: 0, recipients: expected })
      expect(second).toMatchObject({ queued: 0, deduped: expected })
      const rows = await getDb().select().from(emailOutbox).where(like(emailOutbox.dedupeKey, `digest:2026-10-05:%`))
      expect(rows).toHaveLength(expected)
      expect(rows.every((r) => r.priority === 3 && r.template === 'admin-digest')).toBe(true)
      expect(rows.map((r) => r.toEmail)).toEqual(expect.arrayContaining([...DIGEST_RECIPIENTS]))
    }),
  )

  it(
    'leads with the email count and warns as it nears the free plan',
    dbTest(async () => {
      const content = await buildDigest(NOW)
      const data = (sent24h: number) => ({
        dateLabel: 'Monday, Oct 5',
        newTeams: [],
        newTeamsTotal: 0,
        pendingCompanies: [],
        pendingCompaniesTotal: 0,
        openReports: 0,
        waitingPitches: 0,
        oldestWaitingHours: null,
        reviewUrl: 'http://127.0.0.1:3000/admin',
        newUsers: 0,
        activity: [],
        email: { ...content.email, sent24h },
        warnAt: EMAIL_WARN_AT,
      })
      const calm = await renderEmail('admin-digest', data(30))
      const busy = await renderEmail('admin-digest', data(83))
      expect(calm.subject).toContain('30/100 emails')
      expect(busy.subject).toContain('83/100 emails')
      expect(calm.text).not.toContain('Resend Pro')
      expect(busy.text).toContain('Resend Pro')
    }),
  )
})

describe('the daily cron', () => {
  it(
    'runs every job, records one cron_runs row per job, and is safe to run twice',
    dbTest(async () => {
      await createSponsor({ status: 'pending' })
      const unchecked = await createTeam({ recordStatus: 'unchecked', number: 910_000 + Math.floor(Math.random() * 80_000) })
      const sent: string[] = []
      const transport: EmailTransport = { name: 'fake', send: async (email) => (sent.push(email.to), { providerId: `fake-${email.id}` }) }
      const fetchImpl: typeof fetch = async () => Response.json({ data: { teamByNumber: null } })
      const before = (await getDb().select().from(cronRuns)).length

      const first = await runDailyCron({ now: NOW, transport, fetch: fetchImpl, skipStorage: true })
      expect(first.ok).toBe(true)
      expect(first.results.map((r) => r.name)).toEqual(['drain-outbox', 'admin-digest', 'clean-staging', 'recheck-records', 'keepalive'])
      expect((await getDb().select().from(teams).where(eq(teams.id, unchecked.id)))[0].recordStatus).toBe('manual')
      const digestsAfterFirst = await getDb().select().from(emailOutbox).where(eq(emailOutbox.template, 'admin-digest'))

      const second = await runDailyCron({ now: new Date(NOW.getTime() + 60_000), transport, fetch: fetchImpl, skipStorage: true })
      expect(second.ok).toBe(true)
      const digestsAfterSecond = await getDb().select().from(emailOutbox).where(eq(emailOutbox.template, 'admin-digest'))
      expect(digestsAfterSecond.length).toBe(digestsAfterFirst.length)
      const recheck = second.results.find((r) => r.name === 'recheck-records')?.result as { checked: number }
      expect(recheck.checked).toBeLessThanOrEqual((first.results.find((r) => r.name === 'recheck-records')?.result as { checked: number }).checked)

      const runs = await getDb().select().from(cronRuns)
      expect(runs.length - before).toBe(10)
      expect(runs.filter((r) => r.startedAt >= new Date(0)).every((r) => r.finishedAt !== null)).toBe(true)
      const system = await getSystemStatus(new Date(NOW.getTime() + 120_000))
      expect(system.cron.find((j) => j.job === 'keepalive')).toMatchObject({ ok: true, stale: false })
    }),
  )

  it(
    'System shows quota by priority and lets a failed email be retried or dismissed',
    dbTest(async () => {
      const [failed] = await getDb().insert(emailOutbox).values({ toEmail: 'x@pitfund.test', template: 'notice', payload: {}, priority: 1, status: 'failed', lastError: 'boom' }).returning()
      const status = await getSystemStatus(NOW)
      expect(status.problems.map((p) => p.id)).toContain(failed.id)
      await dismissEmail(failed.id, NOW)
      await expectAppError(dismissEmail(failed.id, NOW), 'CONFLICT')
      expect((await getSystemStatus(NOW)).problems.map((p) => p.id)).not.toContain(failed.id)
      await requeueEmail(failed.id, NOW)
      expect((await getDb().select().from(emailOutbox).where(eq(emailOutbox.id, failed.id)))[0]).toMatchObject({ status: 'queued', attempts: 0, dismissedAt: null })
      await expectAppError(requeueEmail(failed.id, NOW), 'CONFLICT')
    }),
  )
})
