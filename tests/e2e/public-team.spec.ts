import type { APIRequestContext } from '@playwright/test'

import { PERSONAS, personaEmail } from '../../lib/shared/personas'
import { SEED } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { PROD_URL } from '../support/env'
import { expect, test } from '../support/fixtures'

/* Plan §10 journey 9: the public team page, its PDF viewer, reporting, and suspension → 404. */

async function expireCaches(request: APIRequestContext) {
  // Tag expiry is compared at one-second resolution: an entry cached in the same second as the
  // expiry can survive it, so never expire right after warming the page.
  await new Promise((r) => setTimeout(r, 1100))
  const res = await request.post('/api/revalidate', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
  expect(res.status()).toBe(200)
}

test.afterAll(async ({ request }) => {
  await db()`update teams set suspended_at = null where id = ${SEED.ironLotus.id}`
  await db()`delete from reports where details = 'E2E report'`
  await expireCaches(request)
  await closeTestDb()
})

test('renders the team, its deck in the viewer, and no personal data', async ({ page, problems }) => {
  const response = await page.goto('/t/31579')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Exodius' })).toBeVisible()
  await expect(page.getByTitle('Checked by FTC Pitfund')).toBeVisible()
  await expect(page.getByText('Team 31579').first()).toBeVisible()
  await expect(page.getByText(/Deck updated/)).toBeVisible()
  await expect(page).toHaveTitle(/Exodius/)
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toMatch(/^https?:\/\//)

  await page.getByRole('link', { name: 'Download PDF' }).scrollIntoViewIfNeeded()
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Page 1 of 4/)).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText(/Page 2 of 4/)).toBeVisible()

  const html = await page.content()
  const coach = PERSONAS.find((p) => p.key === 'coach')!
  for (const secret of [personaEmail('coach'), coach.name, 'Leah Okafor', '555-0142']) expect(html).not.toContain(secret)
  expect(problems).toEqual([])
})

test('a team without a deck says so plainly', async ({ page }) => {
  await page.goto(`/t/${SEED.tidal.number}`)
  await expect(page.getByText('This team hasn’t uploaded its sponsorship deck yet.')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('Report this page stores a report and thanks the reporter', async ({ page, problems }) => {
  await page.goto('/t/31579')
  await page.getByRole('button', { name: 'Report this page' }).click()
  const dialog = page.getByRole('dialog', { name: 'Report this page' })
  await dialog.getByRole('button', { name: 'Send report' }).click()
  await expect(dialog.getByText('Choose a reason')).toBeVisible()
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Spam' }).click()
  await dialog.getByLabel('Details').fill('E2E report')
  await dialog.getByRole('button', { name: 'Send report' }).click()
  await expect(dialog.getByText('Thanks. We\'ll review this page.')).toBeVisible()
  const [report] = await db()`select reason, team_id from reports where details = 'E2E report'`
  expect(report).toMatchObject({ reason: 'spam', team_id: SEED.exodius.id })
  const [note] = await db()`select count(*)::int as n from notifications where type = 'report.created' and title like 'Team 31579%'`
  expect(note.n).toBeGreaterThan(0)
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await expect(dialog).toBeHidden()
  expect(problems).toEqual([])
})

test('in a production build a missing team is a soft 404: the 404 page with noindex', async ({ page }) => {
  const response = await page.goto(`${PROD_URL}/t/99999`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'We couldn\'t find that page' })).toBeVisible()
  const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((el) => el.getAttribute('content')))
  expect(robots.length).toBeGreaterThan(0)
  expect(robots.every((c) => c?.startsWith('noindex'))).toBe(true)
  await expect(page).toHaveTitle(/Team not found/)
})

test('missing and suspended teams are a 404 (dev server: real status)', async ({ page, request }) => {
  expect((await request.get('/t/99999')).status()).toBe(404)
  expect((await request.get('/t/not-a-number')).status()).toBe(404)
  expect((await request.get(`/t/${SEED.ironLotus.number}`)).status()).toBe(200)

  await db()`update teams set suspended_at = now() where id = ${SEED.ironLotus.id}`
  await expireCaches(request)
  const response = await page.goto(`/t/${SEED.ironLotus.number}`)
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'We couldn\'t find that page' })).toBeVisible()

  await db()`update teams set suspended_at = null where id = ${SEED.ironLotus.id}`
  await expireCaches(request)
  expect((await request.get(`/t/${SEED.ironLotus.number}`)).status()).toBe(200)
})
