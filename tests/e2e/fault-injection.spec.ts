import { SEED } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { authFile } from '../support/session'
import { expect, test } from '../support/fixtures'

/*
 * Plan §3.2 error branches not covered by the journeys (prompt 4 §C3): a slow connection, the
 * email provider failing, and a company opening a pitch that was withdrawn. The other injected
 * failures live with their journeys: offline (feedback), aborted storage upload and FIRST timeout
 * (coach-journey), expired code and send failure (auth), revoked invite (team-membership), two
 * admins deciding (sponsor-admin), exhausted email quota (sponsor-admin).
 */

test.afterAll(async () => {
  await closeTestDb()
})

test.describe('on Slow 3G', () => {
  test.use({ storageState: authFile('coach') })

  test('a save acknowledges at once, says what it is doing, and lands', async ({ page, problems }) => {
    await page.goto('/account', { waitUntil: 'networkidle' })
    const cdp = await page.context().newCDPSession(page)
    // Chrome DevTools "Slow 3G": 400 ms RTT (+ server), ~500 kbit/s down, ~500 kbit/s up.
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 })

    const name = page.getByRole('textbox', { name: /^Name/ })
    const original = await name.inputValue()
    await name.fill(`${original} Slow`)
    const clicked = Date.now()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible({ timeout: 300 })
    const acknowledged = Date.now() - clicked
    await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    console.log(`[slow 3g] save acknowledged in ${acknowledged} ms (includes Playwright overhead)`)

    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await name.fill(original)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible()
    expect(problems).toEqual([])
  })
})

test('when the email provider fails, the action still succeeds and System shows the email retrying', async ({ page, browser, problems }) => {
  const details = `E2E provider failure ${Date.now()}`
  await page.context().addCookies([{ name: 'pitfund-simulate', value: 'email-500', url: 'http://127.0.0.1:3000' }])
  await page.goto(`/t/${SEED.tidal.number}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Report this page' }).click()
  const dialog = page.getByRole('dialog', { name: 'Report this page' })
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Spam' }).click()
  await dialog.getByLabel('Details').fill(details)
  await dialog.getByRole('button', { name: 'Send report' }).click()
  // The report is saved and the reporter thanked: email is only a copy.
  await expect(dialog.getByText('Thanks. We\'ll review this page.')).toBeVisible()

  const [report] = await db()`select id from reports where details = ${details}`
  await expect
    .poll(async () => (await db()`select status, last_error from email_outbox where dedupe_key like ${`report:${report.id}:admin-report:%`}`)[0] ?? null, { timeout: 15_000 })
    .toMatchObject({ status: 'queued', last_error: expect.stringContaining('simulated') })

  const admin = await browser.newContext({ storageState: authFile('admin') })
  const system = await admin.newPage()
  await system.goto('/admin/system')
  const queued = system.locator('section', { has: system.getByRole('heading', { name: /Queued email/ }) })
  await expect(queued.getByText(/Resend is unavailable \(simulated\)/).first()).toBeVisible()
  // The admins were still told in the app.
  const [note] = await db()`select count(*)::int as n from notifications where type = 'report.created' and title like ${`Team ${SEED.tidal.number}%`}`
  expect(note.n).toBeGreaterThan(0)
  await admin.close()

  await db()`delete from email_outbox where dedupe_key like ${`report:${report.id}:%`}`
  await db()`delete from reports where id = ${report.id}`
  expect(problems).toEqual([])
})

test.describe('a company', () => {
  test.use({ storageState: authFile('sponsor') })

  test('opening a pitch the team withdrew sees why, and no response buttons', async ({ page, problems }) => {
    await page.goto(`/inbox/${SEED.pitches.knightsToRibosomeWithdrawn}`)
    await expect(page.getByText(/withdrew this pitch\./).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Interested' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Not a fit/ })).toHaveCount(0)
    expect(problems).toEqual([])
  })
})
