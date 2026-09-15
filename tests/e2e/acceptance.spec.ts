import path from 'node:path'

import type { Page } from '@playwright/test'
import sharp from 'sharp'

import { SEED } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { authFile } from '../support/session'
import { expect, test } from '../support/fixtures'
import { messagesTo, waitForLoginCode } from '../support/mailpit'

/*
 * Plan §12 "Product", measured. Typing is instant (fill), so the times are the product's own
 * latency plus the clicks. A "screen" is a distinct page (pathname) the person has to act on; the
 * page that confirms the result isn't counted as a step.
 *
 *   1. A new coach: landing page → submitted first pitch in ≤ 8 screens and under 5 minutes.
 *   2. A new company: sign-up → a complete profile with questions in ≤ 4 screens and under 3 minutes.
 *   3. The admin approves that pitch from the notification email in 2 clicks.
 */

test.describe.configure({ mode: 'serial' })

const FIXTURES = path.resolve('tests/.fixtures')
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

test.afterAll(async () => {
  await closeTestDb()
})

/** Records every distinct pathname the main frame lands on, in order. */
function trackScreens(page: Page) {
  const screens: string[] = []
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const pathname = new URL(frame.url()).pathname
    if (screens.at(-1) !== pathname) screens.push(pathname)
  })
  return screens
}

async function signInWithCode(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('Sign-in code').fill(await waitForLoginCode(email))
}

let submittedPitch: { id: string; number: number } | null = null

test('§12: a new coach goes from the landing page to a submitted pitch in ≤ 8 screens and < 5 minutes', async ({ page, problems }) => {
  test.setTimeout(300_000)
  const email = `e2e-accept-coach-${Date.now()}@pitfund.test`
  const number = 700_000 + Math.floor(Math.random() * 99_999)
  await db()`insert into ftc_team_cache (number, name, city, state, country, source, fetched_at)
    values (${number}, 'Timing Robotics', 'Austin', 'TX', 'USA', 'first', now())
    on conflict (number) do update set fetched_at = now()`
  const screens = trackScreens(page)
  const started = Date.now()

  // 1 · Landing
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'I coach a team' }).first().click()

  // 2 · Sign in
  await page.waitForURL('**/login?intent=team')
  await signInWithCode(page, email)

  // 3 · Welcome: the team branch is already chosen
  await page.waitForURL('**/welcome?intent=team')
  await expect(page.getByRole('radio', { name: /I coach an FTC team/ })).toBeChecked()
  await page.getByLabel('Your name').fill('Jordan Park')
  await page.getByRole('checkbox', { name: 'I’m 18 or older' }).click()
  await page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  // 4 · Team from FIRST records
  await page.waitForURL('**/welcome/team')
  await page.getByLabel('FTC team number').fill(String(number))
  await page.getByRole('button', { name: 'Yes, that’s my team' }).click()
  await page.getByRole('checkbox', { name: /I’m 18 or older and I coach/ }).click()
  await page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
  await page.getByRole('button', { name: 'Create team' }).click()

  // 5 · Pitches: the setup checklist points at the deck
  await page.waitForURL('**/pitches')
  await page.getByRole('link', { name: 'Upload your sponsorship deck' }).click()

  // 6 · Team: deck and summary
  await page.waitForURL(/\/team(#deck)?$/)
  await page.waitForLoadState('networkidle')
  const deck = page.locator('#deck')
  await deck.getByRole('checkbox', { name: /I have permission/ }).click()
  await deck.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'deck-3-pages.pdf'))
  await expect(deck.getByText('Deck updated · visible on your public page')).toBeVisible({ timeout: 60_000 })
  await page.getByLabel('One-line summary').fill('A second-year Austin team that runs free robotics nights for middle schoolers.')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.locator('#profile').getByText('Saved', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sponsors' }).click()

  // 7 · Directory
  await page.waitForURL('**/sponsors')
  await page.getByRole('button', { name: 'Start pitch to Meridian Machine Works' }).click()

  // 8 · Composer
  await page.waitForURL(`**/sponsors/${SEED.meridian}/pitch`)
  await page.getByLabel('Which parts would you want machined, and do you have CAD ready?').locator('visible=true').fill('Two drivetrain side plates. CAD is ready as STEP files.')
  await expect(page.getByText(/Saved · /)).toBeVisible()
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await page.getByRole('dialog', { name: 'Send this pitch to Meridian Machine Works for review?' }).getByRole('button', { name: 'Submit' }).click()

  // Result: the pitch, in review
  await page.waitForURL(/\/pitches\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Submitted for review')).toBeVisible()
  const elapsed = Date.now() - started
  const steps = screens.slice(0, -1)

  test.info().annotations.push({ type: 'screens', description: `${steps.length}: ${steps.join(' → ')}` }, { type: 'duration', description: `${Math.round(elapsed / 1000)} s` })
  console.log(`[§12 coach] ${steps.length} screens (${steps.join(' → ')}) in ${Math.round(elapsed / 1000)} s`)
  expect(steps.length).toBeLessThanOrEqual(8)
  expect(elapsed).toBeLessThan(5 * 60_000)

  submittedPitch = { id: page.url().split('/').pop()!, number }
  expect(problems).toEqual([])
})

test('§12: the admin approves that pitch from the notification email in 2 clicks', async ({ browser }) => {
  test.setTimeout(120_000)
  expect(submittedPitch, 'the coach test submits the pitch this test approves').not.toBeNull()
  const { id, number } = submittedPitch!

  // The instant admin email, and its "Review pitch" link.
  let href: string | null = null
  await expect
    .poll(
      async () => {
        const message = (await messagesTo('admin@pitfund.test')).find((m) => m.Subject === `New pitch: Team ${number} → Meridian Machine Works`)
        if (!message) return null
        const full = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as { HTML: string }
        href = full.HTML.match(/href="([^"]*\/admin\/pitches\/[^"]+)"/)?.[1] ?? null
        return href
      },
      { timeout: 20_000 },
    )
    .not.toBeNull()
  expect(href).toContain(`/admin/pitches/${id}`)

  const context = await browser.newContext({ storageState: authFile('admin') })
  const page = await context.newPage()
  let clicks = 0
  // Click 1: the link in the email.
  clicks++
  await page.goto(href!)
  // Click 2: Approve & send (no confirmation for review decisions, plan §3.1 #7).
  clicks++
  await page.getByRole('button', { name: /Approve & send/ }).click()
  await expect(page.getByText(/Sent to Meridian Machine Works/).first()).toBeVisible()
  const [row] = await db()`select status from pitches where id = ${id}`
  expect(row.status).toBe('sent')

  test.info().annotations.push({ type: 'clicks', description: String(clicks) })
  console.log(`[§12 admin] approved from the email in ${clicks} clicks`)
  expect(clicks).toBe(2)
  await context.close()
})

test('§12: a new company goes from sign-up to a complete profile with questions in ≤ 4 screens and < 3 minutes', async ({ page, problems }) => {
  test.setTimeout(180_000)
  const email = `e2e-accept-company-${Date.now()}@pitfund.test`
  const logo = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#1f6f5c' } }).png().toBuffer()
  const screens = trackScreens(page)
  const started = Date.now()

  // 1 · Sign up (the company door on the landing page)
  await page.goto('/login?intent=company')
  await signInWithCode(page, email)

  // 2 · Welcome: the company branch is already chosen
  await page.waitForURL('**/welcome?intent=company')
  await expect(page.getByRole('radio', { name: /I represent a company/ })).toBeChecked()
  await page.getByLabel('Your name').fill('Riley Chen')
  await page.getByRole('checkbox', { name: 'I’m 18 or older' }).click()
  await page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  // 3 · Company
  await page.waitForURL('**/welcome/company')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Company name').fill(`Lakeside Precision ${Date.now()}`)
  await page.getByLabel('Company website').fill('lakeside-precision.example')
  await page.getByLabel('Your job title').fill('Community Manager')
  await page.getByLabel('Your LinkedIn profile').fill('linkedin.com/in/riley-chen')
  const adult = page.getByRole('checkbox', { name: /18 or older/ })
  if (!(await adult.isChecked())) await adult.click()
  const terms = page.getByRole('checkbox', { name: /I accept the Terms/ })
  if (!(await terms.isChecked())) await terms.click()
  await page.getByRole('button', { name: 'Create company' }).click()

  // 4 · Company profile and questions
  await page.waitForURL('**/company')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Set up your company profile' })).toBeVisible()
  const profile = page.locator('#profile')
  await profile.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo })
  await expect(profile.getByText('Logo updated')).toBeVisible({ timeout: 30_000 })
  await profile.getByLabel('What we look for').fill('Teams near Lake Travis that build their own parts and run outreach.')
  await profile.getByRole('checkbox', { name: 'Equipment' }).click()
  await profile.getByRole('button', { name: 'Save profile' }).click()
  await expect(profile.getByText('Saved', { exact: true })).toBeVisible()

  const questions = page.locator('#questions')
  await questions.getByRole('button', { name: 'Customize' }).click()
  await questions.getByRole('button', { name: 'Add question' }).click()
  await questions.getByLabel('Question').last().fill('Which machining processes does your robot use today?')
  await questions.getByRole('button', { name: 'Save questions' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your company profile' })).toHaveCount(0, { timeout: 15_000 })
  const elapsed = Date.now() - started

  test.info().annotations.push({ type: 'screens', description: `${screens.length}: ${screens.join(' → ')}` }, { type: 'duration', description: `${Math.round(elapsed / 1000)} s` })
  console.log(`[§12 company] ${screens.length} screens (${screens.join(' → ')}) in ${Math.round(elapsed / 1000)} s`)
  expect(screens.length).toBeLessThanOrEqual(4)
  expect(elapsed).toBeLessThan(3 * 60_000)
  expect(problems).toEqual([])
})
