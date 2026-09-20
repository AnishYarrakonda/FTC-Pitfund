import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { seedUuid } from '@/scripts/seed/ids'
import { directoryState, formatAsk, isEditable, isWithdrawable, mergeAnswers, nextStep, submitBlockers, type Ask } from '@/lib/shared/pitch'
import { questionsFor } from '@/lib/shared/questions'
import { saveDraftSchema } from '@/lib/shared/schemas/pitch'
import { createTeamSchema, reportSchema, teamProfileSchema } from '@/lib/shared/schemas/team'
import { setupChecklist } from '@/lib/shared/team'
import { displayWebsite, normalizeWebsite } from '@/lib/shared/url'
import { signInDestination, welcomePath } from '@/lib/shared/viewer'

const NO_ASK: Ask = { type: 'none', amountDollars: null, note: null }

describe('website normalization', () => {
  it('adds https, keeps paths, and rejects things that are not websites', () => {
    expect(normalizeWebsite('exodiusftc.com')).toBe('https://exodiusftc.com')
    expect(normalizeWebsite(' www.example.org/team?x=1 ')).toBe('https://www.example.org/team?x=1')
    expect(normalizeWebsite('http://example.org/')).toBe('http://example.org')
    expect(normalizeWebsite('')).toBeNull()
    for (const bad of ['javascript:alert(1)', 'ftp://example.org', 'localhost', 'not a site.com', 'https://user:pw@example.org', `example.org/${'a'.repeat(300)}`]) {
      expect(normalizeWebsite(bad), bad).toBeNull()
    }
    expect(displayWebsite('https://www.exodiusftc.com/team/')).toBe('exodiusftc.com/team')
  })

  it('the profile schema normalizes and explains', () => {
    const ok = teamProfileSchema.parse({
      name: ' Exodius ',
      location: '  Austin,   Texas, USA ',
      summary: 'Two\n\nlines',
      website: 'exodiusftc.com',
      instagram: 'https://www.instagram.com/exodiusftc/?hl=en',
    })
    expect(ok).toEqual({
      name: 'Exodius',
      location: 'Austin, Texas, USA',
      summary: 'Two lines',
      website: 'https://exodiusftc.com',
      instagram: 'exodiusftc',
    })
    const bad = teamProfileSchema.safeParse({ name: '', location: '', summary: 'x'.repeat(161), website: 'nope', instagram: 'not a handle!' })
    expect(bad.success).toBe(false)
    expect(z.flattenError(bad.error!).fieldErrors).toMatchObject({
      name: ['Enter your team name'],
      location: ['Enter where your team is based'],
      summary: ['Keep the summary to 160 characters'],
      website: ['Enter a website like exodiusftc.com'],
      instagram: ['Enter an Instagram handle like @exodiusftc'],
    })
    // An empty Instagram box is not an error; it just means they don't have one.
    expect(teamProfileSchema.parse({ name: 'E', location: 'Austin', summary: '', website: '', instagram: '' })).toMatchObject({ instagram: null, website: null })
    expect(createTeamSchema.safeParse({ number: '31579', name: 'Exodius', location: 'Austin, Texas, USA', source: 'matched', adult: false, terms: true }).success).toBe(false)
    expect(reportSchema.parse({ teamNumber: 31579, reason: 'spam', details: '', email: '' })).toMatchObject({ details: null, email: null })
  })
})

describe('composer rules', () => {
  const questions = [
    { id: 'a', prompt: 'First?', required: true },
    { id: 'b', prompt: 'Second?', required: false },
  ]

  it('merges saved answers onto the current questions and notices changed questions', () => {
    expect(mergeAnswers(questions, [])).toEqual({ answers: [{ questionId: 'a', prompt: 'First?', answer: '' }, { questionId: 'b', prompt: 'Second?', answer: '' }], changed: false })
    const same = mergeAnswers(questions, [{ questionId: 'a', prompt: 'First?', answer: 'x' }, { questionId: 'b', prompt: 'Second?', answer: '' }])
    expect(same.changed).toBe(false)
    const removed = mergeAnswers(questions, [{ questionId: 'gone', prompt: 'Old?', answer: 'lost' }, { questionId: 'a', prompt: 'First?', answer: 'kept' }])
    expect(removed).toEqual({ answers: [{ questionId: 'a', prompt: 'First?', answer: 'kept' }, { questionId: 'b', prompt: 'Second?', answer: '' }], changed: true })
    expect(mergeAnswers(questions, [{ questionId: 'a', prompt: 'Reworded?', answer: 'x' }, { questionId: 'b', prompt: 'Second?', answer: '' }]).changed).toBe(true)
  })

  it('lists every reason Submit is disabled, with a link or question to fix it', () => {
    const blockers = submitBlockers({ hasDeck: false, hasSummary: false, questions, answers: [{ questionId: 'a', answer: '  ' }], ask: { type: 'in_kind', amountDollars: null, note: ' ' } })
    expect(blockers).toEqual([
      { key: 'deck', message: 'Upload your sponsorship deck', href: '/team#deck' },
      { key: 'summary', message: 'Add your team’s one-line summary', href: '/team#profile' },
      { key: 'answer', message: 'Answer question 1', questionId: 'a' },
      { key: 'ask', message: 'Describe the in-kind support you’re asking for' },
    ])
    expect(submitBlockers({ hasDeck: true, hasSummary: true, questions, answers: [{ questionId: 'a', answer: 'Yes' }], ask: NO_ASK })).toEqual([])
    expect(submitBlockers({ hasDeck: true, hasSummary: true, questions, answers: [{ questionId: 'a', answer: 'Yes' }], ask: { type: 'amount', amountDollars: null, note: null } })).toHaveLength(1)
    // No minimum lengths: one character answers a required question.
    expect(submitBlockers({ hasDeck: true, hasSummary: true, questions, answers: [{ questionId: 'a', answer: 'y' }], ask: NO_ASK })).toEqual([])
  })

  it('default questions interpolate the company name', () => {
    const defaults = questionsFor({ name: 'Acme', questions: [] })
    expect(defaults).toHaveLength(3)
    expect(defaults.some((q) => q.prompt.includes('Acme'))).toBe(true)
  })

  it('draft ids must be UUIDs (seed ids included)', () => {
    const id = seedUuid('pitch', '31579:Ribosome Robotics')
    expect(id).toBe(seedUuid('pitch', '31579:Ribosome Robotics'))
    expect(saveDraftSchema.safeParse({ sponsorId: id, pitchId: null, answers: [], ask: NO_ASK }).success).toBe(true)
    expect(saveDraftSchema.safeParse({ sponsorId: 'nope', pitchId: null, answers: [], ask: NO_ASK }).success).toBe(false)
  })
})

describe('pitch states for coaches', () => {
  it('editable, withdrawable and the directory label follow the lifecycle', () => {
    expect(['draft', 'changes_requested'].every((s) => isEditable(s as never))).toBe(true)
    expect(['in_review', 'sent', 'matched', 'declined', 'rejected', 'withdrawn'].some((s) => isEditable(s as never))).toBe(false)
    expect(['in_review', 'changes_requested', 'sent'].every((s) => isWithdrawable(s as never))).toBe(true)
    expect(['draft', 'matched', 'declined', 'rejected', 'withdrawn'].some((s) => isWithdrawable(s as never))).toBe(false)

    expect(directoryState('s1', null)).toEqual({ kind: 'start' })
    expect(directoryState('s1', { id: 'p1', status: 'withdrawn' })).toEqual({ kind: 'start' })
    expect(directoryState('s1', { id: 'p1', status: 'draft' })).toMatchObject({ label: 'Continue draft', href: '/sponsors/s1/pitch' })
    expect(directoryState('s1', { id: 'p1', status: 'changes_requested' })).toMatchObject({ label: 'Needs changes', href: '/sponsors/s1/pitch' })
    expect(directoryState('s1', { id: 'p1', status: 'sent' })).toMatchObject({ label: 'Sent', href: '/pitches/p1' })
    expect(directoryState('s1', { id: 'p1', status: 'declined' })).toMatchObject({ label: 'Pitched this season' })
    expect(nextStep('in_review', 'Acme')).toBe('Waiting for Pitfund review, usually within a day')
    expect(nextStep('sent', 'Acme')).toBe('Waiting for Acme')
    expect(formatAsk({ type: 'amount', amountCents: 150_000, note: null })).toBe('$1,500')
    expect(formatAsk({ type: 'none', amountCents: null, note: null })).toBeNull()
  })

  it('the setup checklist is complete when deck, summary and logo exist; inviting is optional', () => {
    const base = { hasDeck: true, hasSummary: true, hasLogo: true, memberCount: 1, pendingInvites: 0 }
    expect(setupChecklist(base)).toMatchObject({ complete: true, done: 3, total: 4 })
    expect(setupChecklist({ ...base, hasLogo: false }).complete).toBe(false)
    expect(setupChecklist({ ...base, pendingInvites: 1 }).done).toBe(4)
  })

  it('sign-in sends invite links back to the invite, first-timers to /welcome', () => {
    const coach = { team: { id: 't', status: 'approved' }, sponsor: null, isAdmin: false, pendingJoin: null } as never
    expect(signInDestination(null, '/invite/abc')).toBe('/invite/abc')
    expect(signInDestination({ team: null, sponsor: null, isAdmin: false, pendingJoin: null }, '/pitches')).toBe('/welcome')
    expect(signInDestination(coach, '/team')).toBe('/team')
    expect(signInDestination(coach, null)).toBe('/pitches')

    // A team still behind the review gate ignores ?next: there is nothing in the app to go back to.
    const draft = { team: { id: 't', status: 'draft' }, sponsor: null, isAdmin: false, pendingJoin: null } as never
    const waiting = { team: { id: 't', status: 'pending' }, sponsor: null, isAdmin: false, pendingJoin: null } as never
    expect(signInDestination(draft, '/pitches')).toBe('/welcome/team')
    expect(signInDestination(waiting, '/pitches')).toBe('/welcome/pending')
    // The landing page's "I coach a team" / "I represent a company" preselects the welcome branch, first run only.
    expect(signInDestination(null, null, 'team')).toBe('/welcome?intent=team')
    expect(signInDestination({ team: null, sponsor: null, isAdmin: false, pendingJoin: null }, null, 'company')).toBe('/welcome?intent=company')
    expect(signInDestination(coach, null, 'company')).toBe('/pitches')
    expect(signInDestination(null, '/invite/abc', 'team')).toBe('/invite/abc')
    expect(welcomePath(null)).toBe('/welcome')
  })
})
