import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import type { SponsorViewer, TeamViewer } from '@/lib/server/authz'
import { requireApprovedSponsor, requireTeamMember } from '@/lib/server/authz'
import { confirmDefaultQuestions, createCompany, getCompanyProfile, leaveCompany, removeCompanyMember, saveCompanyQuestions } from '@/lib/server/data/company'
import { getCompanyForAdmin } from '@/lib/server/data/admin-orgs'
import { queryDirectory, queryDirectorySponsor } from '@/lib/server/data/directory'
import { getInboxPitch, listInbox, respondInterested, respondNotAFit } from '@/lib/server/data/inbox'
import { createInvite, inviteOrgFor } from '@/lib/server/data/invites'
import { getTeamPitch, startPitch } from '@/lib/server/data/pitches'
import { getDb } from '@/lib/server/db'
import { auditEvents, pitches, sponsorMembers, sponsors, users, type PitchStatus } from '@/lib/server/schema'
import { loadViewer } from '@/lib/server/viewer'
import { companyChecklist, declineReasonText, normalizeLinkedin } from '@/lib/shared/company'
import { createCompanySchema, declineSchema, questionsSchema } from '@/lib/shared/schemas/company'

import { addSponsorMember, addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'
import { expectAppError } from './helpers/errors'

/*
 * The company side (prompt 3, scopes A–C): creating a company, visibility while pending, the
 * questions editor, invites while pending, members, and the inbox with its two responses.
 */

const NOW = new Date('2026-10-02T15:00:00Z')

const sponsorViewer = async (userId: string) => (await loadViewer(userId)) as SponsorViewer
const teamViewer = async (userId: string) => (await loadViewer(userId)) as TeamViewer

/** A team with two coaches and a sent pitch to an approved company with two members. */
async function world(status: PitchStatus = 'sent') {
  const team = await createTeam({ summary: 'We build robots.', pdfPath: 'teams/x/deck.pdf', pdfPages: 2, pdfBytes: 10 })
  const coach = await createUser({ name: 'Maya Coach', phone: '555-0100' })
  const coach2 = await createUser()
  await addTeamMember(team.id, coach.id)
  await addTeamMember(team.id, coach2.id)
  const company = await createSponsor({ website: 'https://acme.example' })
  const rep = await createUser({ name: 'Dana Rep', jobTitle: 'Partnerships Lead', phone: '555-0199' })
  const rep2 = await createUser()
  await addSponsorMember(company.id, rep.id)
  await addSponsorMember(company.id, rep2.id)
  const [pitch] = await getDb()
    .insert(pitches)
    .values({ teamId: team.id, sponsorId: company.id, season: 2026, status, createdBy: coach.id, submittedBy: coach.id, submittedAt: NOW, sentAt: status === 'draft' || status === 'in_review' ? null : NOW, answers: [{ questionId: 'q', prompt: 'Why?', answer: 'Because.' }] })
    .returning()
  return { team, coach, coach2, company, rep, rep2, pitch, repViewer: await sponsorViewer(rep.id), coachViewer: await teamViewer(coach.id) }
}

async function otherSponsor() {
  const company = await createSponsor()
  const user = await createUser()
  await addSponsorMember(company.id, user.id)
  return sponsorViewer(user.id)
}

describe('company first run', () => {
  it(
    'creates a draft company owned by the applicant, with their title and terms',
    dbTest(async () => {
      const user = await createUser({ acceptedTermsAt: null })
      const viewer = (await loadViewer(user.id))!
      const company = await createCompany(viewer, { name: 'Acme Robotics Fund', website: 'https://acme.example', yourName: 'Pat Lee', jobTitle: 'Giving Lead', linkedin: 'https://www.linkedin.com/in/patlee' })
      const [row] = await getDb().select().from(sponsors).where(eq(sponsors.id, company.id))
      // A draft, not pending: it reaches the admin queue only when they send it for review.
      expect(row).toMatchObject({ status: 'draft', applicantTitle: 'Giving Lead', applicantLinkedin: 'https://www.linkedin.com/in/patlee' })
      const [person] = await getDb().select().from(users).where(eq(users.id, user.id))
      expect(person).toMatchObject({ name: 'Pat Lee', jobTitle: 'Giving Lead' })
      expect(person.acceptedTermsAt).not.toBeNull()
      const [member] = await getDb().select().from(sponsorMembers).where(eq(sponsorMembers.userId, user.id))
      expect(member).toMatchObject({ sponsorId: company.id, role: 'owner' })
      const [event] = await getDb().select().from(auditEvents).where(and(eq(auditEvents.entityId, company.id), eq(auditEvents.action, 'sponsor.created')))
      expect(event.actorId).toBe(user.id)

      // Someone already in an org can't create another.
      await expectAppError(createCompany((await loadViewer(user.id))!, { name: 'Again', website: 'https://x.example', yourName: 'P', jobTitle: 'T', linkedin: null }), 'CONFLICT')
    }),
  )

  it('validates and normalizes the onboarding form', () => {
    const base = { name: 'Acme', website: 'acme.example', yourName: 'Pat', jobTitle: 'Lead', linkedin: '', adult: true, terms: true }
    const ok = createCompanySchema.safeParse(base)
    expect(ok.success && ok.data).toMatchObject({ website: 'https://acme.example', linkedin: null })
    expect(createCompanySchema.safeParse({ ...base, website: 'not a site' }).success).toBe(false)
    expect(createCompanySchema.safeParse({ ...base, jobTitle: '' }).success).toBe(false)
    expect(createCompanySchema.safeParse({ ...base, linkedin: 'twitter.com/pat' }).success).toBe(false)
    expect(createCompanySchema.safeParse({ ...base, adult: false }).success).toBe(false)
    expect(normalizeLinkedin('linkedin.com/in/pat-lee/')).toBe('https://www.linkedin.com/in/pat-lee')
    expect(normalizeLinkedin('https://evil.example/linkedin.com/in/x')).toBeNull()
  })
})

describe('company visibility', () => {
  it(
    'a pending company is invisible to coaches but visible to itself and to admins',
    dbTest(async () => {
      const company = await createSponsor({ status: 'pending', name: `Zeta Pending ${Math.random()}` })
      const member = await createUser()
      await addSponsorMember(company.id, member.id)
      const team = await createTeam()
      const coach = await createUser()
      await addTeamMember(team.id, coach.id)

      expect(await queryDirectorySponsor(company.id)).toBeNull()
      expect((await queryDirectory({ q: company.name, after: null, before: null })).items).toEqual([])
      await expectAppError(startPitch(await teamViewer(coach.id), company.id, NOW), 'NOT_FOUND')

      expect((await getCompanyProfile(await sponsorViewer(member.id))).status).toBe('pending')
      const admin = await createUser({ isAdmin: true })
      expect((await getCompanyForAdmin((await loadViewer(admin.id))!, company.id)).status).toBe('pending')

      // Approval makes it visible.
      await getDb().update(sponsors).set({ status: 'approved' }).where(eq(sponsors.id, company.id))
      expect((await queryDirectorySponsor(company.id))?.id).toBe(company.id)
      expect((await queryDirectory({ q: company.name, after: null, before: null })).items.map((i) => i.id)).toEqual([company.id])
    }),
  )

  it(
    'a pending company cannot invite coworkers; an approved one can',
    dbTest(async () => {
      const company = await createSponsor({ status: 'pending' })
      const member = await createUser()
      await addSponsorMember(company.id, member.id)
      const viewer = await sponsorViewer(member.id)
      await expectAppError(createInvite(viewer, inviteOrgFor(viewer, 'sponsor'), 'coworker@acme.example', NOW), 'FORBIDDEN', { message: `You can invite coworkers once ${company.name} is approved.` })
      await expectAppError(requireApprovedSponsor({ viewer }), 'FORBIDDEN')

      await getDb().update(sponsors).set({ status: 'approved' }).where(eq(sponsors.id, company.id))
      const approved = await sponsorViewer(member.id)
      const { invite } = await createInvite(approved, inviteOrgFor(approved, 'sponsor'), 'coworker@acme.example', NOW)
      expect(invite).toMatchObject({ kind: 'sponsor', sponsorId: company.id })
    }),
  )
})

describe('questions editor', () => {
  it('allows 0–10 questions with a prompt ≤ 200, help ≤ 300 and unique ids', () => {
    const q = (i: number) => ({ id: `q-${i}`, prompt: `Question ${i}?`, help: '', required: true })
    expect(questionsSchema.safeParse({ questions: [] }).success).toBe(true)
    expect(questionsSchema.safeParse({ questions: Array.from({ length: 10 }, (_, i) => q(i)) }).success).toBe(true)
    expect(questionsSchema.safeParse({ questions: Array.from({ length: 11 }, (_, i) => q(i)) }).success).toBe(false)
    expect(questionsSchema.safeParse({ questions: [{ ...q(1), prompt: '  ' }] }).success).toBe(false)
    expect(questionsSchema.safeParse({ questions: [{ ...q(1), prompt: 'x'.repeat(201) }] }).success).toBe(false)
    expect(questionsSchema.safeParse({ questions: [{ ...q(1), help: 'x'.repeat(301) }] }).success).toBe(false)
    expect(questionsSchema.safeParse({ questions: [q(1), q(1)] }).success).toBe(false)
    const parsed = questionsSchema.parse({ questions: [q(1)] })
    expect(parsed.questions[0].help).toBeUndefined()
  })

  it(
    'saves, reorders and resets questions; the database refuses more than 10; the checklist tracks review',
    dbTest(async () => {
      const company = await createSponsor({ status: 'pending' })
      const member = await createUser()
      await addSponsorMember(company.id, member.id)
      const viewer = await sponsorViewer(member.id)
      const start = await getCompanyProfile(viewer)
      expect(start).toMatchObject({ usesDefaultQuestions: true, reviewedQuestions: false })
      expect(start.questions).toHaveLength(3)
      expect(start.questions[0].prompt).toContain(company.name)

      const saved = await saveCompanyQuestions(viewer, [
        { id: 'b', prompt: ' Second ', help: ' hint ', required: false },
        { id: 'a', prompt: 'First', required: true },
      ])
      expect(saved.customQuestions).toEqual([
        { id: 'b', prompt: 'Second', help: 'hint', required: false },
        { id: 'a', prompt: 'First', required: true },
      ])
      await expectAppError(saveCompanyQuestions(viewer, Array.from({ length: 11 }, (_, i) => ({ id: `q${i}`, prompt: 'Q', required: true }))), 'VALIDATION')
      const reset = await saveCompanyQuestions(viewer, [])
      expect(reset).toMatchObject({ usesDefaultQuestions: true, reviewedQuestions: true })
      await expect(getDb().update(sponsors).set({ questions: Array.from({ length: 11 }, (_, i) => ({ id: `q${i}`, prompt: 'Q', required: true })) }).where(eq(sponsors.id, company.id))).rejects.toThrow()
    }),
  )

  it(
    'keeping the defaults completes the checklist item',
    dbTest(async () => {
      const company = await createSponsor({ status: 'pending' })
      const member = await createUser()
      await addSponsorMember(company.id, member.id)
      const viewer = await sponsorViewer(member.id)
      expect((await confirmDefaultQuestions(viewer)).reviewedQuestions).toBe(true)
      const list = companyChecklist({ hasLogo: false, hasAbout: true, supportTypeCount: 1, questionCount: 0, reviewedQuestions: true })
      expect(list.items.find((i) => i.key === 'questions')?.done).toBe(true)
      expect(list.complete).toBe(false)
    }),
  )
})

describe('company members', () => {
  it(
    'removes a coworker, and the last member cannot leave',
    dbTest(async () => {
      const company = await createSponsor()
      const a = await createUser()
      const b = await createUser()
      await addSponsorMember(company.id, a.id)
      await addSponsorMember(company.id, b.id)
      const viewer = await sponsorViewer(a.id)
      await expectAppError(removeCompanyMember(viewer, a.id), 'VALIDATION')
      expect((await removeCompanyMember(viewer, b.id)).userId).toBe(b.id)
      await expectAppError(removeCompanyMember(viewer, b.id), 'NOT_FOUND')
      await expectAppError(leaveCompany(await sponsorViewer(a.id)), 'CONFLICT')
    }),
  )
})

describe('the inbox', () => {
  it(
    'lists only sent, matched and declined pitches for the viewer’s own company',
    dbTest(async () => {
      const w = await world('sent')
      for (const status of ['draft', 'in_review', 'changes_requested', 'rejected'] as const) {
        const team = await createTeam()
        await getDb().insert(pitches).values({ teamId: team.id, sponsorId: w.company.id, season: 2026, status })
      }
      const inbox = await listInbox(w.repViewer)
      expect(inbox.sent.map((p) => p.id)).toEqual([w.pitch.id])
      expect(inbox.matched).toEqual([])
      expect(inbox.declined).toEqual([])
      const hidden = await getDb().select({ id: pitches.id, status: pitches.status }).from(pitches).where(eq(pitches.sponsorId, w.company.id))
      for (const p of hidden.filter((h) => h.id !== w.pitch.id)) await expectAppError(getInboxPitch(w.repViewer, p.id), 'NOT_FOUND')

      const stranger = await otherSponsor()
      expect(await listInbox(stranger)).toEqual({ sent: [], matched: [], declined: [] })
      await expectAppError(getInboxPitch(stranger, w.pitch.id), 'NOT_FOUND')
      await expectAppError(respondInterested(stranger, w.pitch.id, NOW), 'NOT_FOUND')
      await expectAppError(respondNotAFit(stranger, w.pitch.id, null, NOW), 'NOT_FOUND')
    }),
  )

  it(
    'Interested snapshots both contacts; each side sees the other only once matched',
    dbTest(async () => {
      const w = await world('sent')
      expect((await getInboxPitch(w.repViewer, w.pitch.id)).contact).toBeNull()
      expect((await getTeamPitch(w.coachViewer, w.pitch.id, NOW)).contact).toBeNull()

      const result = await respondInterested(w.repViewer, w.pitch.id, NOW)
      expect(result.teamContact).toMatchObject({ name: 'Maya Coach', email: w.coach.email, phone: '555-0100', teamNumber: w.team.number })
      expect(result.sponsorContact).toMatchObject({ name: 'Dana Rep', jobTitle: 'Partnerships Lead', email: w.rep.email, phone: '555-0199', companyName: w.company.name, website: 'https://acme.example' })

      const [row] = await getDb().select().from(pitches).where(eq(pitches.id, w.pitch.id))
      expect(row).toMatchObject({ status: 'matched', respondedBy: w.rep.id, respondedAt: NOW })

      // Both members of the company and both coaches see the other side's contact.
      expect((await getInboxPitch(await sponsorViewer(w.rep2.id), w.pitch.id)).contact?.email).toBe(w.coach.email)
      expect((await getTeamPitch(await teamViewer(w.coach2.id), w.pitch.id, NOW)).contact?.email).toBe(w.rep.email)
      // Nobody else does.
      await expectAppError(getInboxPitch(await otherSponsor(), w.pitch.id), 'NOT_FOUND')
      const outsider = await createTeam()
      const outsiderCoach = await createUser()
      await addTeamMember(outsider.id, outsiderCoach.id)
      await expectAppError(getTeamPitch(await teamViewer(outsiderCoach.id), w.pitch.id, NOW), 'NOT_FOUND')

      // Answering again is a conflict, either way.
      await expectAppError(respondInterested(await sponsorViewer(w.rep2.id), w.pitch.id, NOW), 'CONFLICT')
      await expectAppError(respondNotAFit(w.repViewer, w.pitch.id, null, NOW), 'CONFLICT')
      const [event] = await getDb().select().from(auditEvents).where(and(eq(auditEvents.entityId, w.pitch.id), eq(auditEvents.action, 'pitch.matched')))
      expect(event.actorId).toBe(w.rep.id)
    }),
  )

  it(
    'Not a fit records an optional reason and never exposes contacts',
    dbTest(async () => {
      const w = await world('sent')
      expect(declineReasonText('region', null)).toBe('Outside our region')
      expect(declineReasonText('other', '  Too far  ')).toBe('Too far')
      expect(declineReasonText(null, 'ignored')).toBeNull()
      expect(declineSchema.safeParse({ pitchId: w.pitch.id, reason: 'other', note: '' }).success).toBe(false)
      expect(declineSchema.safeParse({ pitchId: w.pitch.id, reason: null, note: null }).success).toBe(true)

      const result = await respondNotAFit(w.repViewer, w.pitch.id, 'Outside our region', NOW)
      expect(result.coach?.email).toBe(w.coach.email)
      const detail = await getInboxPitch(w.repViewer, w.pitch.id)
      expect(detail).toMatchObject({ status: 'declined', declineReason: 'Outside our region', contact: null })
      expect((await getTeamPitch(w.coachViewer, w.pitch.id, NOW)).contact).toBeNull()
      expect((await listInbox(w.repViewer)).declined.map((p) => p.id)).toEqual([w.pitch.id])
    }),
  )

  it(
    'a pitch withdrawn after it was sent is a read-only notice, and cannot be answered',
    dbTest(async () => {
      const w = await world('sent')
      await getDb().update(pitches).set({ status: 'withdrawn' }).where(eq(pitches.id, w.pitch.id))
      const detail = await getInboxPitch(w.repViewer, w.pitch.id)
      expect(detail).toMatchObject({ withdrawn: true, contact: null, deck: null })
      expect(detail.view.answers).toEqual([])
      await expectAppError(respondInterested(w.repViewer, w.pitch.id, NOW), 'CONFLICT', { message: `Team ${w.team.number} · ${w.team.name} withdrew this pitch.` })
      await expectAppError(respondNotAFit(w.repViewer, w.pitch.id, null, NOW), 'CONFLICT')
      // A pitch withdrawn before it was ever sent doesn't exist for the company.
      const other = await world('in_review')
      await getDb().update(pitches).set({ status: 'withdrawn' }).where(eq(pitches.id, other.pitch.id))
      await expectAppError(getInboxPitch(other.repViewer, other.pitch.id), 'NOT_FOUND')
    }),
  )

  it(
    'a suspended company’s members are blocked, and a coach asking for another team gets NOT_FOUND',
    dbTest(async () => {
      const w = await world('sent')
      await getDb().update(sponsors).set({ status: 'suspended' }).where(eq(sponsors.id, w.company.id))
      await expectAppError(requireApprovedSponsor({ viewer: await sponsorViewer(w.rep.id) }), 'FORBIDDEN')
      await expectAppError(requireTeamMember({ viewer: w.coachViewer, teamId: crypto.randomUUID() }), 'NOT_FOUND')
    }),
  )
})
