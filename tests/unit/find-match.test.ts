import { describe, expect, it } from 'vitest'

import { INTENT_IDS, matchIntent, stem } from '@/components/home/effects/find-match'

/*
 * The corpus for the "Find where to start" box (components/home/effects/find-match.ts).
 *
 * The thing this replaces was a first-match-wins regex chain, and every case below is one it got
 * wrong: a sentence about price that mentioned a company, a typo, a sentence whose subject is only
 * in the word order. So the corpus is the specification — when a weight changes, this is what says
 * whether it changed for the better. Add the sentence first, then tune.
 */

const expectIntent = (query: string, id: string) => {
  const m = matchIntent(query)
  expect(m, `"${query}" matched nothing`).not.toBeNull()
  expect(`${query} → ${m!.intent.id}`).toBe(`${query} → ${id}`)
}

describe('stem', () => {
  it('folds the forms of a word onto each other', () => {
    for (const [a, b] of [
      ['sponsors', 'sponsor'],
      ['companies', 'company'],
      ['pitches', 'pitch'],
      ['reviewed', 'review'],
      ['funding', 'fund'],
      ['questions', 'question'],
      ['students', 'student'],
      ['pages', 'page'],
      ['fees', 'fee'],
    ] as const)
      expect(`${a}→${stem(a)}`).toBe(`${a}→${stem(b)}`)
  })

  it('leaves words that only look plural alone', () => {
    for (const w of ['business', 'us', 'this', 'stem', 'csr']) expect(stem(w)).toBe(stem(w.replace(/s$/, 's')))
    expect(stem('business')).toBe('business')
    expect(stem('need')).toBe('need')
  })
})

describe('matchIntent', () => {
  it('says nothing when there is nothing to go on', () => {
    for (const q of ['', '   ', 'hello', 'hi there', 'asdfgh', '?????', 'the and or', '12345']) expect(matchIntent(q), q).toBeNull()
  })

  it('routes the two doors', () => {
    for (const q of [
      'I coach a team',
      'i coach an ftc team in ohio and we need help paying for a field kit',
      'we are a rookie team looking for sponsors',
      'my team needs a sponsor for travel to the state championship',
      'mentor for team 31579',
      'how do we find companies to sponsor our robotics team',
      'trying to raise money for our competition season',
    ])
      expectIntent(q, 'coach')

    for (const q of [
      'I represent a company',
      'our company wants to sponsor a robotics team',
      'i work at a manufacturer and we give back to stem',
      'we are a foundation that makes grants',
      'my business would like to support teams',
      'how do we start receiving pitches',
      'csr program looking to fund robotics',
    ])
      expectIntent(q, 'company')
  })

  it('answers the question that was asked, not the side it was asked from', () => {
    // Every one of these mentions a company or a team, and used to be routed on that word alone.
    expectIntent('how much does it cost a company', 'cost')
    expectIntent('does our company have to pay a fee', 'cost')
    expectIntent('is it free for teams', 'cost')
    expectIntent('do you take a cut of the sponsorship', 'cost')
    expectIntent('who reviews the pitches our company gets', 'review')
    expectIntent('can students on my team have accounts', 'adults')
    expectIntent('how many pages can our team deck be', 'deck')
    expectIntent('who can see my email address', 'privacy')
    expectIntent('can our team pitch the same company twice', 'season')
    expectIntent('how do we verify our team on the first dashboard', 'verified')
    expectIntent('can i invite my colleague to our company account', 'members')
    expectIntent('how many questions can a company write', 'questions')
    expectIntent('does the team get a public page', 'public')
    expectIntent('do i need a password to sign in', 'account')
    // No second-factor keyword in the index (see find-match.ts); the phrase has to carry this one.
    expectIntent('do i need 2fa to sign in', 'account')
    expectIntent('how does this whole thing work', 'howitworks')
  })

  it('survives the typos people actually make', () => {
    expectIntent('we need a sponser for our robotics team', 'coach')
    expectIntent('is it realy free', 'cost')
    expectIntent('how do i uplaod our deck', 'deck')
    expectIntent('who reveiws the pitches', 'review')
    expectIntent('is my privacey protected', 'privacy')
    expectIntent('can studnets make an acount', 'adults')
    expectIntent('our compnay wants to sponsor', 'company')
  })

  it('offers the runner-up when the sentence really is about both', () => {
    const m = matchIntent('i coach a team and i also work at a company that could sponsor')
    expect(m).not.toBeNull()
    expect([m!.intent.id, m!.runnerUp?.id].sort()).toEqual(['coach', 'company'])
  })

  it('keeps the runner-up out of the way when one answer is clearly right', () => {
    expect(matchIntent('is it free')?.runnerUp).toBeUndefined()
    expect(matchIntent('i coach a team')?.runnerUp).toBeUndefined()
    // The chips under the box are meant to be decisive: each one gets a single answer.
    for (const chip of ['I coach a team', 'I represent a company', 'How does review work?', 'Is it free?']) {
      const m = matchIntent(chip)
      expect(m, chip).not.toBeNull()
      expect(`${chip} → ${m!.runnerUp?.id}`).toBe(`${chip} → undefined`)
    }
  })

  it('reports a confidence that rises with how much the sentence said', () => {
    const vague = matchIntent('free')!
    const said = matchIntent('is it free, or is there a subscription fee we would have to pay')!
    expect(vague.confidence).toBeGreaterThan(0)
    expect(said.confidence).toBeGreaterThan(vague.confidence)
    expect(said.confidence).toBeLessThanOrEqual(1)
  })

  it('always returns an intent the page can actually render', () => {
    for (const q of ['i coach a team', 'how much', 'privacy', 'invite a colleague']) {
      const m = matchIntent(q)!
      expect(INTENT_IDS).toContain(m.intent.id)
      expect(m.intent.href).toMatch(/^(\/|#)/)
      expect(m.intent.cta.length).toBeGreaterThan(2)
      expect(m.intent.text.length).toBeGreaterThan(40)
    }
  })

  it('stays fast enough to run on every keystroke', () => {
    const q = 'i coach a rookie first tech challenge team in ohio and we are looking for a local company to sponsor our field kit and travel'
    const start = performance.now()
    for (let i = 0; i < 200; i++) matchIntent(q)
    expect((performance.now() - start) / 200).toBeLessThan(2)
  })
})
