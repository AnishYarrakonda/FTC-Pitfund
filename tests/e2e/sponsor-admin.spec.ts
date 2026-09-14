import type { Browser, Page } from '@playwright/test'

import type { PersonaKey } from '../../lib/shared/personas'
import { SEED, seedPitchId } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { expect, test, watchProblems } from '../support/fixtures'
import { messagesTo } from '../support/mailpit'
import { seed } from '../support/seed'
import { authFile } from '../support/session'

/*
 * Plan §10 journeys 3, 4, 7, 8 and 10 (prompt 3): admin review with send back, resubmission and
 * approval; a company says Interested and both sides see contacts; another pitch is Not a fit; a
 * pending company becomes visible when approved; company isolation; the exhausted email quota; a
 * keyboard-only review with auto-advance; and two admins deciding the same pitch. These tests change
 * the seeded world, so the file reseeds `demo` when it finishes.
 */

test.describe.configure({ mode: 'serial' })

const VOLTAGE_TO_CEDAR = seedPitchId(24890, 'Cedar Valley Credit Union')

test.afterAll(async () => {
  await db()`delete from email_outbox where resend_id like 'e2e-quota-%'`
  await closeTestDb()
  seed('demo')
})

async function as(browser: Browser, persona: PersonaKey) {
  const context = await browser.newContext({ storageState: authFile(persona), viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  return { page, problems: watchProblems(page), close: () => context.close() }
}

async function waitForEmail(to: string, subject: RegExp, since: number) {
  await expect
    .poll(async () => (await messagesTo(to)).some((m) => subject.test(m.Subject) && new Date(m.Created).getTime() >= since - 2000), { timeout: 20_000 })
    .toBe(true)
}

async function decideOnPage(page: Page) {
  return page.getByRole('button', { name: /Approve & send/ })
}

test('admin sends back, the coach resubmits, the admin approves, the company connects; another pitch is not a fit', async ({ browser }) => {
  test.setTimeout(180_000)
  const started = Date.now()
  const admin = await as(browser, 'admin')
  const coach = await as(browser, 'coach-unverified')
  const company = await as(browser, 'sponsor2')
  const brightline = await as(browser, 'sponsor')

  // ─── Admin: send back with a note ─────────────────────────────────────────────────────
  await admin.page.goto(`/admin/pitches/${VOLTAGE_TO_CEDAR}`)
  await expect(admin.page.getByRole('heading', { name: /Team 24890 · Voltage Vultures → Cedar Valley Credit Union/ })).toBeVisible()
  await expect(admin.page.getByText('The pitch, exactly as Cedar Valley Credit Union will see it')).toBeVisible()
  await admin.page.getByRole('button', { name: /Send back/ }).click()
  const sendBack = admin.page.getByRole('dialog', { name: 'Send back to Team 24890' })
  await sendBack.getByRole('button', { name: 'Send back' }).click()
  await expect(sendBack.getByText('Write a note for the team')).toBeVisible()
  await sendBack.getByLabel(/Note for the team/).fill('Say what the funding would pay for in the second answer.')
  await sendBack.getByRole('button', { name: 'Send back' }).click()
  await expect(admin.page.getByText(/Sent back · Team 24890 was told/)).toBeVisible()
  await admin.page.waitForURL((url) => !url.pathname.endsWith(VOLTAGE_TO_CEDAR))
  await waitForEmail('coach-unverified@pitfund.test', /Changes requested on your pitch to Cedar Valley Credit Union/, started)

  // ─── Coach: sees the note, edits, resubmits ───────────────────────────────────────────
  await coach.page.goto(`/pitches/${VOLTAGE_TO_CEDAR}`)
  await expect(coach.page.getByText('Say what the funding would pay for in the second answer.').first()).toBeVisible()
  await coach.page.getByRole('link', { name: 'Edit and resubmit' }).click()
  await coach.page.waitForURL(`**/sponsors/${SEED.cedar}/pitch`, { waitUntil: 'networkidle' })
  const answer = coach.page.getByRole('textbox').nth(1)
  await answer.fill('It pays for state championship registration ($1,200) and a spare control hub ($600).')
  await expect(coach.page.getByText(/Saved/).first()).toBeVisible({ timeout: 10_000 })
  await coach.page.getByRole('button', { name: 'Resubmit for review' }).click()
  await coach.page.getByRole('dialog').getByRole('button', { name: 'Resubmit' }).click()
  await coach.page.waitForURL(`**/pitches/${VOLTAGE_TO_CEDAR}`)
  await expect(coach.page.getByText('Resubmitted for review')).toBeVisible()

  // ─── Admin: approve; every company member is emailed ──────────────────────────────────
  await admin.page.goto(`/admin/pitches/${VOLTAGE_TO_CEDAR}`)
  await expect(admin.page.getByText('Resubmitted', { exact: true })).toBeVisible()
  await (await decideOnPage(admin.page)).click()
  await expect(admin.page.getByText(/Sent to Cedar Valley Credit Union · 1 person notified/)).toBeVisible()
  await waitForEmail('sponsor2@pitfund.test', /New pitch from Team 24890 · Voltage Vultures/, started)
  await waitForEmail('coach-unverified@pitfund.test', /Your pitch to Cedar Valley Credit Union was sent/, started)

  // ─── Company: Interested → Connected; the coach sees the company's contact ────────────
  await company.page.goto('/inbox')
  await company.page.getByRole('link', { name: /Voltage Vultures/ }).click()
  await company.page.waitForURL(`**/inbox/${VOLTAGE_TO_CEDAR}`)
  await company.page.getByRole('button', { name: 'Interested' }).click()
  const connect = company.page.getByRole('dialog', { name: 'Connect with Team 24890 · Voltage Vultures?' })
  await expect(connect.getByText(/We’ll share your name, title and email with Team 24890 · Voltage Vultures, and theirs with you./)).toBeVisible()
  await connect.getByRole('button', { name: 'Share contact details' }).click()
  await expect(company.page.getByRole('heading', { name: 'You’re connected with Team 24890 · Voltage Vultures' })).toBeVisible()
  await expect(company.page.getByRole('link', { name: 'coach-unverified@pitfund.test' })).toBeVisible()
  await waitForEmail('coach-unverified@pitfund.test', /Cedar Valley Credit Union is interested in Team 24890/, started)
  await waitForEmail('sponsor2@pitfund.test', /You’re connected with Team 24890/, started)

  await coach.page.goto(`/pitches/${VOLTAGE_TO_CEDAR}`)
  await expect(coach.page.getByRole('heading', { name: 'Connected with Cedar Valley Credit Union' })).toBeVisible()
  await expect(coach.page.getByRole('link', { name: 'sponsor2@pitfund.test' })).toBeVisible()

  // ─── Another pitch: Not a fit with a reason; the row moves ────────────────────────────
  await brightline.page.goto(`/inbox/${SEED.pitches.voltageToBrightlineSent}`)
  await brightline.page.getByRole('button', { name: 'Not a fit' }).click()
  const notAFit = brightline.page.getByRole('dialog', { name: 'Mark this pitch not a fit?' })
  await notAFit.getByRole('radio', { name: 'Outside our region' }).click()
  await notAFit.getByRole('button', { name: 'Mark not a fit' }).click()
  await brightline.page.waitForURL('**/inbox')
  await expect(brightline.page.getByText('Marked not a fit. Team 24890 · Voltage Vultures has been notified.')).toBeVisible()
  const notAFitGroup = brightline.page.locator('section', { has: brightline.page.getByRole('heading', { name: /^Not a fit/ }) })
  await expect(notAFitGroup.getByText('Voltage Vultures')).toBeVisible()
  await waitForEmail('coach-unverified@pitfund.test', /Brightline Engineering isn’t a fit this time/, started)
  await coach.page.goto(`/pitches/${SEED.pitches.voltageToBrightlineSent}`)
  await expect(coach.page.getByText('Outside our region').first()).toBeVisible()

  for (const p of [admin, coach, company, brightline]) expect(p.problems).toEqual([])
  for (const p of [admin, coach, company, brightline]) await p.close()
})

test('a pending company is invisible to coaches until an admin approves it', async ({ browser }) => {
  const started = Date.now()
  const coach = await as(browser, 'coach')
  const admin = await as(browser, 'admin')
  const pending = await as(browser, 'sponsor-pending')

  await pending.page.goto('/inbox')
  await expect(pending.page.getByText('Your company is under review', { exact: true })).toBeVisible()
  await pending.page.goto('/company')
  await expect(pending.page.getByRole('button', { name: /Invite by email/ })).toBeDisabled()
  await expect(pending.page.getByText('You can invite coworkers once Atlas Components is approved.')).toBeVisible()

  await coach.page.goto(`/sponsors/${SEED.atlasPending}`)
  await expect(coach.page.getByRole('heading', { name: 'We couldn\'t find that page' })).toBeVisible()
  await coach.page.goto('/sponsors?q=Atlas')
  await expect(coach.page.getByText('No companies match')).toBeVisible()

  await admin.page.goto('/admin?tab=companies')
  await admin.page.getByRole('link', { name: /Atlas Components/ }).click()
  await admin.page.waitForURL(`**/admin/companies/${SEED.atlasPending}`)
  await expect(admin.page.getByText('Head of People', { exact: true })).toBeVisible()
  await admin.page.getByRole('button', { name: 'Approve' }).click()
  await expect(admin.page.getByText(/Atlas Components is approved · 1 person emailed/)).toBeVisible()
  await waitForEmail('sponsor-pending@pitfund.test', /Atlas Components is approved on FTC Pitfund/, started)

  await coach.page.goto(`/sponsors/${SEED.atlasPending}`)
  await expect(coach.page.getByRole('heading', { name: 'Atlas Components' })).toBeVisible()
  await coach.page.goto('/sponsors?q=Atlas')
  await expect(coach.page.getByRole('link', { name: /Atlas Components/ })).toBeVisible()
  await pending.page.goto('/inbox')
  await expect(pending.page.getByText('No pitches yet')).toBeVisible()

  for (const p of [coach, admin, pending]) expect(p.problems).toEqual([])
  for (const p of [coach, admin, pending]) await p.close()
})

test('a new company signs up and lands on its pending inbox', async ({ browser }) => {
  const person = await as(browser, 'sponsor-new')
  await person.page.goto('/welcome/company', { waitUntil: 'networkidle' })
  await person.page.getByRole('button', { name: 'Create company' }).click()
  await expect(person.page.getByText('Enter your company’s name')).toBeVisible()
  await person.page.getByLabel('Company name').fill('Riverbend Robotics Fund')
  await person.page.getByLabel('Company website').fill('riverbend.example')
  await person.page.getByLabel('Your job title').fill('Community Manager')
  await person.page.getByLabel('Your LinkedIn profile').fill('twitter.com/riverbend')
  await person.page.getByRole('checkbox', { name: /18 or older/ }).click()
  await person.page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
  await person.page.getByRole('button', { name: 'Create company' }).click()
  await expect(person.page.getByText('Enter a LinkedIn link like linkedin.com/in/your-name')).toBeVisible()
  await person.page.getByLabel('Your LinkedIn profile').fill('linkedin.com/in/riley-newco')
  await person.page.getByRole('button', { name: 'Create company' }).click()
  await person.page.waitForURL('**/inbox')
  await expect(person.page.getByText('Your company is under review', { exact: true })).toBeVisible()
  await expect(person.page.getByRole('heading', { name: 'Set up your company profile' })).toBeVisible()
  expect(person.problems).toEqual([])
  await person.close()
})

test.describe('company isolation', () => {
  test.use({ storageState: authFile('sponsor2') })
  test('another company’s pitches are a 404, and a coach can’t open the inbox', async ({ page, browser }) => {
    for (const id of [SEED.pitches.exodiusMatched, SEED.pitches.quokkasToBrightlineSent, SEED.pitches.lotusToBrightlineInReview]) {
      await page.goto(`/inbox/${id}`)
      await expect(page.getByRole('heading', { name: 'We couldn\'t find that page' })).toBeVisible()
    }
    await expect(page.getByText('Exodius')).toHaveCount(0)
    const coach = await as(browser, 'coach')
    await coach.page.goto(`/inbox/${SEED.pitches.exodiusMatched}`)
    await coach.page.waitForURL('**/pitches')
    await coach.close()
  })
})

test('with the email quota exhausted, approval says email is delayed and System shows it queued', async ({ browser }) => {
  const sql = db()
  const [{ used }] = await sql<{ used: number }[]>`select count(*)::int as used from email_outbox where sent_at > now() - interval '24 hours'`
  const needed = Math.max(0, 95 - used)
  for (let i = 0; i < needed; i++) {
    await sql`insert into email_outbox (to_email, template, payload, priority, status, attempts, resend_id, sent_at, send_after)
      values ('quota@pitfund.test', 'notice', '{}'::jsonb, 1, 'sent', 1, ${`e2e-quota-${i}`}, now() - interval '1 hour', now() - interval '1 hour')`
  }
  const admin = await as(browser, 'admin')
  await admin.page.goto(`/admin/pitches/${SEED.pitches.exodiusInReview}`)
  await (await decideOnPage(admin.page)).click()
  await expect(admin.page.getByText('Sent to Meridian Machine Works · email delayed until tomorrow')).toBeVisible()

  await admin.page.goto('/admin/system')
  await expect(admin.page.getByText('Email delivery is delayed until the 24-hour window frees up. Sign-in codes still go out.')).toBeVisible()
  const queued = admin.page.locator('section', { has: admin.page.getByRole('heading', { name: /Queued email/ }) })
  await expect(queued.getByText('new-pitch-sponsor · Pitches and accounts')).toBeVisible()
  await expect(queued.getByText(/Sends after/).first()).toBeVisible()

  const coach = await as(browser, 'coach')
  await coach.page.goto(`/pitches/${SEED.pitches.exodiusInReview}`)
  await expect(coach.page.getByText('Email to Meridian Machine Works delayed until tomorrow; they can see it in FTC Pitfund.')).toBeVisible()
  expect(admin.problems).toEqual([])
  await sql`delete from email_outbox where resend_id like 'e2e-quota-%'`
  await admin.close()
  await coach.close()
})

test('two admins deciding the same pitch: the second is told who decided', async ({ browser }) => {
  const first = await as(browser, 'admin')
  const second = await as(browser, 'admin')
  const pitch = SEED.pitches.tidalToHarborInReview
  await first.page.goto(`/admin/pitches/${pitch}`)
  await second.page.goto(`/admin/pitches/${pitch}`, { waitUntil: 'networkidle' })
  await (await decideOnPage(first.page)).click()
  await expect(first.page.getByText(/Sent to Harbor Point Energy/)).toBeVisible()
  await (await decideOnPage(second.page)).click()
  await expect(second.page.getByText('Avery Admin already approved this pitch.')).toBeVisible()
  await second.page.getByRole('button', { name: 'Refresh' }).click()
  await expect(second.page.getByText(/Avery Admin approved and sent this pitch/)).toBeVisible()

  // A company suspended while its pitch is open for review blocks approval with the reason.
  await first.page.goto(`/admin/pitches/${SEED.pitches.sagesToVantageInReview}`)
  await expect(first.page.getByText('Vantage Promotions is suspended, so it can’t receive pitches.')).toBeVisible()
  await expect(await decideOnPage(first.page)).toBeDisabled()
  await first.close()
  await second.close()
})

test('keyboard-only review: S and R open their note dialogs, A approves, J and K move, and each decision advances', async ({ browser }) => {
  test.setTimeout(120_000)
  // Earlier tests decided some seeded pitches: put three approvable ones back in the queue.
  const queue = [SEED.pitches.lotusToBrightlineInReview, SEED.pitches.quokkasToBrightlineSent, SEED.pitches.tidalToHarborInReview]
  await db()`update pitches set status = 'in_review', sent_at = null, reviewed_by = null, reviewed_at = null, review_note = null where id = any(${queue})`
  const admin = await as(browser, 'admin')
  const { page } = admin
  await page.goto('/admin', { waitUntil: 'networkidle' })
  const start = page.getByRole('link', { name: 'Start reviewing' })
  await start.focus()
  await page.keyboard.press('Enter')
  await page.waitForURL('**/admin/pitches/**', { waitUntil: 'networkidle' })

  const heading = () => page.getByRole('heading', { level: 1 }).innerText()
  // Keys only work once the pitch page (and its key listener) has rendered, not while it streams.
  const ready = () => expect(page.getByRole('button', { name: /Approve & send/ })).toBeVisible()
  await ready()
  const decide = async (key: 'A' | 'S' | 'R') => {
    // Skip pitches that can't be approved (a suspended company) when approving.
    while (key === 'A' && (await (await decideOnPage(page)).isDisabled())) {
      const skipped = await heading()
      await page.keyboard.press('j')
      await expect.poll(heading).not.toBe(skipped)
      await ready()
    }
    const current = page.url()
    const title = await heading()
    await page.keyboard.press(key.toLowerCase())
    if (key !== 'A') {
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      if (key === 'S') await page.keyboard.type('Please name the parts you need.')
      // Tab from the note to Cancel, then to the submit button.
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
    }
    await expect(page.getByText(key === 'A' ? /^Sent to / : key === 'S' ? /^Sent back · / : /^Rejected · /)).toBeVisible()
    await page.waitForURL((url) => url.toString() !== current)
    if (new URL(page.url()).pathname === '/admin') {
      // The queue is empty: auto-advance lands on the review page.
      await expect(page.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible()
      return false
    }
    await expect.poll(heading).not.toBe(title)
    await ready()
    return true
  }

  const firstHeading = await heading()
  await page.keyboard.press('j')
  await expect.poll(heading).not.toBe(firstHeading)
  await ready()
  await page.keyboard.press('k')
  await expect.poll(heading).toBe(firstHeading)
  await ready()

  expect(await decide('S')).toBe(true)
  expect(await decide('R')).toBe(true)
  await decide('A')
  expect(admin.problems).toEqual([])
  await admin.close()
})
