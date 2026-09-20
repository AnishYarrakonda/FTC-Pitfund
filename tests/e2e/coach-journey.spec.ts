import path from 'node:path'

import type { Page } from '@playwright/test'

import { SEED } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { expect, test } from '../support/fixtures'
import { messagesTo, waitForLoginCode } from '../support/mailpit'

/*
 * Plan §10 journeys 2 and 5: a brand-new coach signs in with an emailed code, creates a team from
 * FIRST records, uploads a deck (an 8-page PDF is rejected, an interrupted upload retries), writes
 * a summary, pitches a company, submits, withdraws, and can pitch that company again.
 */

const FIXTURES = path.resolve('tests/.fixtures')
const STORAGE_PUT = '**/storage/v1/object/upload/sign/**'

test.afterAll(async () => {
  await closeTestDb()
})

/** Sign in with a brand-new address (code from Mailpit) and answer /welcome as a coach. */
async function signInAsNewCoach(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('Sign-in code').fill(await waitForLoginCode(email))
  await page.waitForURL('**/welcome')
  await page.getByLabel('Your name').fill('Jamie Rivera')
  await page.getByRole('radio', { name: /I coach an FTC team/ }).click()
  await page.getByRole('checkbox', { name: 'I’m 18 or older' }).click()
  await page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/welcome/team')
}

test('a new coach goes from sign-in to a submitted pitch, withdraws it, and can pitch again', async ({ page, problems }) => {
  test.setTimeout(180_000)
  const email = `e2e-coach-${Date.now()}@pitfund.test`
  const number = 800_000 + Math.floor(Math.random() * 99_999)
  await db()`insert into ftc_team_cache (number, name, city, state, country, source, fetched_at)
    values (${number}, 'Journey Robotics', 'Austin', 'TX', 'USA', 'first', now())
    on conflict (number) do update set fetched_at = now()`

  // ─── Sign in and welcome ───────────────────────────────────────────────────────────────
  await signInAsNewCoach(page, email)

  // ─── Team setup from FIRST records ─────────────────────────────────────────────────────
  await page.getByLabel('FTC team number').fill(String(number))
  await expect(page.getByText(`Team ${number} · Journey Robotics`)).toBeVisible()
  await page.getByRole('button', { name: 'Yes, that’s my team' }).click()
  await expect(page.getByLabel('Team name')).toHaveValue('Journey Robotics')
  await page.getByRole('button', { name: 'Create team' }).click()
  await expect(page.getByText('Confirm that you’re 18 or older and coach or mentor this team')).toBeVisible()
  await page.getByRole('checkbox', { name: /I’m 18 or older and I coach/ }).click()
  await page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
  await page.getByRole('button', { name: 'Create team' }).click()
  // A new team is a draft: it lands on its setup page, not in the app.
  await expect(page.getByRole('heading', { name: `Tell us about Team ${number}` })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send for review' })).toBeDisabled()

  // ─── Deck upload ───────────────────────────────────────────────────────────────────────
  // File inputs only react once React has hydrated the page.
  await page.goto('/welcome/team', { waitUntil: 'networkidle' })
  const deck = page.locator('#deck')
  const fileInput = deck.locator('input[type=file]')
  await fileInput.setInputFiles(path.join(FIXTURES, 'deck-8-pages.pdf'))
  await expect(deck.getByText('This PDF has 8 pages. The limit is 5.')).toBeVisible()
  await fileInput.setInputFiles(path.join(FIXTURES, 'not-a-pdf.pdf'))
  await expect(deck.getByText('This file isn’t a readable PDF.')).toBeVisible()

  // Consent is required before anything uploads; ticking it continues with the chosen file.
  await page.route(STORAGE_PUT, (route) => route.abort('connectionreset'))
  await fileInput.setInputFiles(path.join(FIXTURES, 'deck-3-pages.pdf'))
  await expect(deck.getByText(/Your file deck-3-pages.pdf is ready to upload/)).toBeVisible()
  await deck.getByRole('checkbox', { name: /I have permission/ }).click()
  await expect(deck.getByText('Upload interrupted.')).toBeVisible()

  // Retry keeps the file; a slowed upload shows its stage and progress.
  await page.unroute(STORAGE_PUT)
  await page.route(STORAGE_PUT, async (route) => {
    await new Promise((r) => setTimeout(r, 1200))
    await route.continue()
  })
  await deck.getByRole('button', { name: 'Retry' }).click()
  await expect(deck.getByText(/Uploading/)).toBeVisible()
  await expect(deck.getByText('Deck updated · visible on your public page')).toBeVisible({ timeout: 30_000 })
  await page.unroute(STORAGE_PUT)
  await expect(deck.getByText(/3 pages/)).toBeVisible()

  // ─── Summary ───────────────────────────────────────────────────────────────────────────
  await page.getByLabel('One-line summary').fill('Rookie Austin team building its first competition robot.')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.locator('#profile').getByText('Saved', { exact: true })).toBeVisible()

  const [team] = await db()`select id, pdf_pages, record_status, media_consent_at, status from teams where number = ${number}`
  expect(team).toMatchObject({ pdf_pages: 3, record_status: 'matched', status: 'draft' })
  expect(team.media_consent_at).not.toBeNull()

  // The review itself is covered end to end by acceptance.spec.ts and isolation.spec.ts; this test
  // is about pitching, so approve the team directly and get on with it.
  await db()`update teams set status = 'approved', decided_at = now() where number = ${number}`

  // ─── Directory → composer ──────────────────────────────────────────────────────────────
  await page.goto('/sponsors')
  await expect(page.getByRole('heading', { name: 'Sponsors' })).toBeVisible()
  await expect(page.getByText('Allele Components')).toHaveCount(0)
  await page.goto(`/sponsors/${SEED.meridian}`)
  await page.getByRole('button', { name: 'Start pitch' }).click()
  await page.waitForURL(`**/sponsors/${SEED.meridian}/pitch`)
  await expect(page.getByRole('heading', { name: 'Pitch Mitochondria Machine Works' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Answer question 1' })).toBeVisible()

  const answer = page.getByLabel('Which parts would you want machined, and do you have CAD ready?').locator('visible=true')
  await answer.fill('Two drivetrain side plates. CAD is ready as STEP files.')
  await expect(page.getByText(/Saved · /)).toBeVisible()
  const [draft] = await db()`select id, status, answers from pitches where team_id = ${team.id} and sponsor_id = ${SEED.meridian}`
  expect(draft.status).toBe('draft')
  expect(draft.answers[0].answer).toBe('Two drivetrain side plates. CAD is ready as STEP files.')

  await page.getByRole('button', { name: 'Submit for review' }).click()
  const confirm = page.getByRole('dialog', { name: 'Send this pitch to Mitochondria Machine Works for review?' })
  await confirm.getByRole('button', { name: 'Submit' }).click()
  await page.waitForURL(`**/pitches/${draft.id}`)
  await expect(page.getByText('Waiting for Pitfund review, usually within a day').first()).toBeVisible()
  await expect(page.getByText('Submitted for review')).toBeVisible()

  // Admins get the instant email.
  await expect
    .poll(async () => (await messagesTo('admin@pitfund.test')).some((m) => m.Subject === `New pitch: Team ${number} → Mitochondria Machine Works`), { timeout: 20_000 })
    .toBe(true)

  // ─── Withdraw frees the slot ───────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Withdraw' }).click()
  await page.getByRole('dialog', { name: 'Withdraw this pitch?' }).getByRole('button', { name: 'Withdraw pitch' }).click()
  await expect(page.getByText('You withdrew this pitch').first()).toBeVisible()
  await page.goto(`/sponsors/${SEED.meridian}`)
  await expect(page.getByRole('button', { name: 'Start pitch' })).toBeVisible()

  // The only expected failure is the storage PUT this test aborted on purpose.
  expect(problems.filter((p) => !p.includes('ERR_CONNECTION_RESET'))).toEqual([])
})

test.describe('failure states', () => {
  test('FIRST records timing out and an autosave failure explain themselves and recover', async ({ page, context, problems }) => {
    test.setTimeout(120_000)
    const email = `e2e-fail-${Date.now()}@pitfund.test`
    await signInAsNewCoach(page, email)

    // Path "/" explicitly: deriving it from page.url() scopes the cookie to whatever directory the
    // page happens to be in, so it silently stops being sent after navigating elsewhere.
    const simulate = (value: string) =>
      context.addCookies([{ name: 'pitfund-simulate', value, domain: new URL(page.url()).hostname, path: '/' }])
    const stopSimulating = () => context.clearCookies({ name: 'pitfund-simulate' })
    await simulate('ftc-timeout')
    const number = 700_000 + Math.floor(Math.random() * 99_999)
    await page.getByLabel('FTC team number').fill(String(number))
    await expect(page.getByText('Checking FIRST records…')).toBeVisible()
    await expect(page.getByText('FIRST records aren’t reachable right now. Enter your team name and city; we’ll check them later.')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Enter details' }).click()
    // The form moves focus to Team name on the next frame; typing before that lands in the wrong field.
    await expect(page.getByLabel('Team name')).toBeFocused()
    await page.getByLabel('Team name').fill('Offline Robotics')
    await page.getByLabel('Location').fill('Austin, Texas, USA')
    await page.getByRole('checkbox', { name: /I’m 18 or older and I coach/ }).click()
    await page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
    await page.getByRole('button', { name: 'Create team' }).click()
    await expect(page.getByRole('heading', { name: `Tell us about Team ${number}` })).toBeVisible()
    // Pitching is what the rest of this test is about; the review is covered elsewhere.
    await db()`update teams set status = 'approved', decided_at = now() where number = ${number}`
    const [team] = await db()`select record_status from teams where number = ${number}`
    expect(team.record_status).toBe('unchecked')

    await simulate('save-draft')
    await page.goto(`/sponsors/${SEED.meridian}/pitch`)
    await page.getByLabel('Which parts would you want machined, and do you have CAD ready?').locator('visible=true').fill('Side plates.')
    await expect(page.getByText('Couldn’t save.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    await stopSimulating()
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText(/Saved · /)).toBeVisible()
    // The failed save answers with a Result, not a thrown error.
    expect(problems).toEqual([])
  })
})
