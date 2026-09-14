import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import type { TeamViewer } from '@/lib/server/authz'
import { buildTimeline, deleteDraft, getTeamPitch, listTeamPitches, saveDraft, startPitch, submitPitch, withdrawPitch } from '@/lib/server/data/pitches'
import { teamPitchesBySponsor } from '@/lib/server/data/directory'
import { getDb } from '@/lib/server/db'
import { auditEvents, pitches, type PitchStatus } from '@/lib/server/schema'
import { loadViewer } from '@/lib/server/viewer'
import type { Ask } from '@/lib/shared/pitch'
import { pitchSeason } from '@/lib/shared/season'

import { addSponsorMember, addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'
import { expectAppError } from './helpers/errors'

const NOW = new Date('2026-10-01T12:00:00Z')
const NO_ASK: Ask = { type: 'none', amountDollars: null, note: null }
const QUESTIONS = [
  { id: 'q-why', prompt: 'Why us?', required: true },
  { id: 'q-extra', prompt: 'Anything else?', required: false },
]

/** A coach on a team that is ready to submit (deck + summary), pitching an approved company. */
async function setup(options: { ready?: boolean } = {}) {
  const ready = options.ready ?? true
  const team = await createTeam(ready ? { pdfPath: 'teams/x/deck.pdf', pdfPages: 3, pdfBytes: 1000, pdfUpdatedAt: NOW, summary: 'We build robots.' } : {})
  const coach = await createUser()
  await addTeamMember(team.id, coach.id)
  const company = await createSponsor({ questions: QUESTIONS })
  const rep = await createUser()
  await addSponsorMember(company.id, rep.id)
  const viewer = (await loadViewer(coach.id)) as TeamViewer
  return { team, coach, company, rep, viewer }
}

async function otherCoach() {
  const team = await createTeam()
  const user = await createUser()
  await addTeamMember(team.id, user.id)
  return (await loadViewer(user.id)) as TeamViewer
}

const statusOf = async (id: string) => (await getDb().select({ status: pitches.status }).from(pitches).where(eq(pitches.id, id)))[0]?.status
const setStatus = (id: string, status: PitchStatus) => getDb().update(pitches).set({ status }).where(eq(pitches.id, id))

describe('starting and saving a pitch', () => {
  it(
    'Start pitch creates one draft per season and reuses it',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const first = await startPitch(viewer, company.id, NOW)
      expect(first.created).toBe(true)
      expect(await startPitch(viewer, company.id, NOW)).toEqual({ pitchId: first.pitchId, created: false })
      const [row] = await getDb().select().from(pitches).where(eq(pitches.id, first.pitchId))
      expect(row).toMatchObject({ status: 'draft', season: pitchSeason(NOW), createdBy: viewer.id })
      expect(row.answers.map((a) => a.questionId)).toEqual(['q-why', 'q-extra'])
    }),
  )

  it(
    'only approved companies can be pitched',
    dbTest(async () => {
      const { viewer } = await setup()
      for (const status of ['pending', 'rejected', 'suspended'] as const) {
        const company = await createSponsor({ status })
        await expectAppError(startPitch(viewer, company.id, NOW), 'NOT_FOUND')
        await expectAppError(saveDraft(viewer, { sponsorId: company.id, pitchId: null, answers: [], ask: NO_ASK }, NOW), 'NOT_FOUND')
      }
    }),
  )

  it(
    'a submitted pitch is a season conflict that links to it',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      await setStatus(pitchId, 'sent')
      await expectAppError(startPitch(viewer, company.id, NOW), 'CONFLICT', { message: `You've already pitched ${company.name} this season.`, href: `/pitches/${pitchId}` })
      // Next season the slot is open again.
      const nextSeason = new Date('2027-09-02T12:00:00Z')
      expect((await startPitch(viewer, company.id, nextSeason)).created).toBe(true)
    }),
  )

  it(
    'autosave creates the draft on first save, keeps answers by current question id, and stores the ask',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const saved = await saveDraft(
        viewer,
        { sponsorId: company.id, pitchId: null, answers: [{ questionId: 'q-why', answer: 'Because.' }, { questionId: 'gone', answer: 'dropped' }], ask: { type: 'amount', amountDollars: 1500, note: 'ignored' } },
        NOW,
      )
      const [row] = await getDb().select().from(pitches).where(eq(pitches.id, saved.pitchId))
      expect(row.answers).toEqual([
        { questionId: 'q-why', prompt: 'Why us?', answer: 'Because.' },
        { questionId: 'q-extra', prompt: 'Anything else?', answer: '' },
      ])
      expect(row).toMatchObject({ askType: 'amount', askAmountCents: 150_000, askNote: null })

      await saveDraft(viewer, { sponsorId: company.id, pitchId: saved.pitchId, answers: [], ask: { type: 'in_kind', amountDollars: 5, note: 'Motors' } }, NOW)
      const [again] = await getDb().select().from(pitches).where(eq(pitches.id, saved.pitchId))
      expect(again).toMatchObject({ askType: 'in_kind', askAmountCents: null, askNote: 'Motors' })
    }),
  )

  it(
    'saving a submitted, withdrawn or another team’s pitch fails',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      const input = { sponsorId: company.id, pitchId, answers: [], ask: NO_ASK }
      await setStatus(pitchId, 'in_review')
      await expectAppError(saveDraft(viewer, input, NOW), 'CONFLICT', { href: `/pitches/${pitchId}` })
      await setStatus(pitchId, 'changes_requested')
      await expect(saveDraft(viewer, input, NOW)).resolves.toMatchObject({ pitchId })
      await expectAppError(saveDraft(await otherCoach(), input, NOW), 'NOT_FOUND')
    }),
  )
})

describe('submitting', () => {
  it(
    'is blocked until the team has a deck and summary and required answers are filled',
    dbTest(async () => {
      const unready = await setup({ ready: false })
      const draft = await startPitch(unready.viewer, unready.company.id, NOW)
      await expectAppError(submitPitch(unready.viewer, { pitchId: draft.pitchId, answers: [{ questionId: 'q-why', answer: 'Yes' }], ask: NO_ASK }, NOW), 'VALIDATION', {
        field: 'deck',
        href: '/team#deck',
      })

      const { viewer, company } = await setup()
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      const error = await expectAppError(submitPitch(viewer, { pitchId, answers: [{ questionId: 'q-why', answer: '   ' }], ask: NO_ASK }, NOW), 'VALIDATION', {
        field: 'answers.q-why',
      })
      expect(error.extra.fieldErrors).toEqual({ 'answers.q-why': 'Answer this question to submit' })
      await expectAppError(submitPitch(viewer, { pitchId, answers: [{ questionId: 'q-why', answer: 'Yes' }], ask: { type: 'amount', amountDollars: null, note: null } }, NOW), 'VALIDATION', {
        field: 'ask',
      })
      expect(await statusOf(pitchId)).toBe('draft')
    }),
  )

  it(
    'moves draft → in_review with a snapshot, audits, returns admins, and cannot run twice',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const admin = await createUser({ isAdmin: true })
      await createUser({ isAdmin: true, suspendedAt: NOW })
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      const result = await submitPitch(viewer, { pitchId, answers: [{ questionId: 'q-why', answer: 'We fit.' }], ask: NO_ASK }, NOW)
      expect(result.pitch).toMatchObject({ status: 'in_review', submittedBy: viewer.id, submittedAt: NOW })
      expect(result.pitch.answers[0]).toEqual({ questionId: 'q-why', prompt: 'Why us?', answer: 'We fit.' })
      expect(result.admins.map((a) => a.id)).toContain(admin.id)
      expect(result.admins.every((a) => a.id !== viewer.id)).toBe(true)
      expect(result.resubmission).toBe(false)
      const events = await getDb().select().from(auditEvents).where(eq(auditEvents.entityId, pitchId))
      expect(events.map((e) => e.action).sort()).toEqual(['pitch.created', 'pitch.submitted'])

      await expectAppError(submitPitch(viewer, { pitchId, answers: [{ questionId: 'q-why', answer: 'Again' }], ask: NO_ASK }, NOW), 'CONFLICT')
      await expectAppError(submitPitch(await otherCoach(), { pitchId, answers: [], ask: NO_ASK }, NOW), 'NOT_FOUND')
    }),
  )

  it(
    'resubmitting after changes were requested keeps the original season',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      await getDb().update(pitches).set({ status: 'changes_requested', reviewNote: 'Be specific.' }).where(eq(pitches.id, pitchId))
      const later = new Date('2027-09-05T12:00:00Z')
      const result = await submitPitch(viewer, { pitchId, answers: [{ questionId: 'q-why', answer: 'Specific.' }], ask: NO_ASK }, later)
      expect(result.resubmission).toBe(true)
      expect(result.pitch).toMatchObject({ status: 'in_review', season: pitchSeason(NOW) })
    }),
  )
})

describe('withdrawing and deleting', () => {
  it(
    'withdraw is allowed from in_review, changes_requested and sent, and frees the season slot',
    dbTest(async () => {
      const { viewer, company, rep } = await setup()
      for (const from of ['in_review', 'changes_requested', 'sent'] as const) {
        const { pitchId } = await startPitch(viewer, company.id, NOW)
        await setStatus(pitchId, from)
        const result = await withdrawPitch(viewer, pitchId, NOW)
        expect(result.wasSent).toBe(from === 'sent')
        expect(result.members.map((m) => m.id)).toEqual(from === 'sent' ? [rep.id] : [])
        expect(await statusOf(pitchId)).toBe('withdrawn')
        expect(await teamPitchesBySponsor(viewer, NOW)).toEqual({})
        await expectAppError(withdrawPitch(viewer, pitchId, NOW), 'CONFLICT', { message: 'This pitch was already withdrawn.' })
      }
    }),
  )

  it(
    'withdraw is refused for drafts, answered pitches and other teams',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      await expectAppError(withdrawPitch(viewer, pitchId, NOW), 'CONFLICT', { message: 'A draft can’t be withdrawn. Delete it instead.' })
      for (const status of ['matched', 'declined', 'rejected'] as const) {
        await setStatus(pitchId, status)
        await expectAppError(withdrawPitch(viewer, pitchId, NOW), 'CONFLICT')
        expect(await statusOf(pitchId)).toBe(status)
      }
      await setStatus(pitchId, 'sent')
      await expectAppError(withdrawPitch(await otherCoach(), pitchId, NOW), 'NOT_FOUND')
      expect(await statusOf(pitchId)).toBe('sent')
    }),
  )

  it(
    'only a draft can be deleted, and only by its team',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      await expectAppError(deleteDraft(await otherCoach(), pitchId), 'NOT_FOUND')
      await setStatus(pitchId, 'in_review')
      await expectAppError(deleteDraft(viewer, pitchId), 'CONFLICT')
      await setStatus(pitchId, 'draft')
      await expect(deleteDraft(viewer, pitchId)).resolves.toMatchObject({ id: pitchId })
      expect(await statusOf(pitchId)).toBeUndefined()
    }),
  )
})

describe('reading pitches', () => {
  it(
    'a coach sees only their team’s pitches, and contact details only when matched',
    dbTest(async () => {
      const { viewer, company } = await setup()
      const { pitchId } = await startPitch(viewer, company.id, NOW)
      const contact = { name: 'Rep', email: 'rep@example.com', phone: null, jobTitle: 'Lead' }
      await getDb().update(pitches).set({ status: 'sent', sponsorContact: contact }).where(eq(pitches.id, pitchId))

      const other = await otherCoach()
      expect(await listTeamPitches(other)).toEqual([])
      await expectAppError(getTeamPitch(other, pitchId, NOW), 'NOT_FOUND')

      expect((await listTeamPitches(viewer)).map((p) => p.id)).toEqual([pitchId])
      expect((await getTeamPitch(viewer, pitchId, NOW)).contact).toBeNull()
      await setStatus(pitchId, 'matched')
      const detail = await getTeamPitch(viewer, pitchId, NOW)
      expect(detail.contact).toEqual(contact)
      expect(detail.timeline.map((e) => e.title)).toEqual(['Created'])
    }),
  )

  it('the timeline explains delayed and failed email to the company', () => {
    const at = NOW
    const events = [
      { id: '1', action: 'pitch.submitted', data: {}, createdAt: at },
      { id: '2', action: 'pitch.sent_back', data: { note: 'Add numbers.' }, createdAt: at },
      { id: '3', action: 'pitch.submitted', data: { resubmission: true }, createdAt: at },
      { id: '4', action: 'pitch.approved', data: {}, createdAt: at },
      { id: '5', action: 'pitch.withdrawn', data: { from: 'sent' }, createdAt: at },
    ]
    const later = new Date(NOW.getTime() + 12 * 60 * 60 * 1000)
    const timeline = buildTimeline(events, {
      company: 'Acme',
      declineReason: null,
      now: NOW,
      emails: [
        { template: 'new-pitch-sponsor', status: 'queued', sendAfter: later },
        { template: 'pitch-withdrawn', status: 'failed', sendAfter: NOW },
      ],
    })
    expect(timeline.map((e) => e.title)).toEqual(['Submitted for review', 'Sent back with a note', 'Resubmitted for review', 'Approved and sent to Acme', 'Withdrawn'])
    expect(timeline[1].note).toBe('Add numbers.')
    expect(timeline[3].description).toBe('Email to Acme delayed until tomorrow; they can see it in FTC Pitfund.')
    expect(timeline[4].description).toBe('Email to Acme couldn’t be delivered; they can still see it in FTC Pitfund.')
    expect(buildTimeline(events.slice(3, 4), { company: 'Acme', declineReason: null, now: NOW, emails: [{ template: 'new-pitch-sponsor', status: 'sent', sendAfter: NOW }] })[0].description).toBeNull()
  })
})
