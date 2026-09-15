import type { Page } from '@playwright/test'

import { closeTestDb, db } from '../support/db'
import { expect, test } from '../support/fixtures'
import { messagesTo, waitForLoginCode } from '../support/mailpit'

/*
 * Sign in (plan §3.2): the email-code state machine with every branch, Google's button and
 * cancel copy, and sign out. Codes are read from Mailpit, so the whole path is real:
 * Supabase Auth → Send Email hook → outbox → SMTP → Mailpit.
 */

const freshEmail = (tag: string) => `e2e-${tag}-${Date.now()}@pitfund.test`

test.afterAll(async () => {
  await closeTestDb()
})

async function requestCode(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  return since
}

test('signs in with an emailed code, rejecting a wrong one first', async ({ page, problems }) => {
  const email = freshEmail('login')
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  // Acknowledged immediately with a verb label.
  await expect(page.getByRole('button', { name: 'Sending code…' })).toBeVisible()
  await expect(page.getByText(`We sent a 6-digit code to ${email}. It expires in 10 minutes.`)).toBeVisible()

  const code = await waitForLoginCode(email)
  const wrong = code === '000000' ? '111111' : '000000'
  await page.getByLabel('Sign-in code').fill(wrong)
  await expect(page.getByText("That code isn't right. Check the latest email.")).toBeVisible()
  await expect(page.getByLabel('Sign-in code')).toBeFocused()

  await page.getByLabel('Sign-in code').fill(code)
  await page.waitForURL('**/welcome')
  await expect(page.getByRole('heading', { name: 'Welcome to FTC Pitfund' })).toBeVisible()
  expect(problems).toEqual([])
})

test('the email is branded FTC Pitfund and never mentions Supabase', async ({ page }) => {
  const email = freshEmail('brand')
  await requestCode(page, email)
  await waitForLoginCode(email)
  const [message] = await messagesTo(email)
  expect(message.Subject).toMatch(/^\d{6} is your FTC Pitfund sign-in code$/)
  const body = await (await fetch(`${process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'}/api/v1/message/${message.ID}`)).json()
  expect(body.From.Name).toBe('FTC Pitfund')
  expect(`${body.HTML}${body.Text}`).not.toMatch(/supabase|my application/i)
  expect(body.Text).toContain('Not affiliated with or endorsed by FIRST®')
  expect(body.Text).toContain('ftcexodius@gmail.com')
})

test('resend unlocks after 30 seconds and sends a new code', async ({ page }) => {
  const email = freshEmail('resend')
  await page.clock.install()
  await requestCode(page, email)
  await waitForLoginCode(email)
  const resend = page.getByRole('button', { name: /Resend code \(in \d+s\)/ })
  await expect(resend).toBeDisabled()

  // The browser clock jumps 31 s; Supabase's own minimum gap (5 s locally) runs on real time.
  await page.waitForTimeout(5500)
  await page.clock.fastForward('00:31')
  const since = Date.now()
  await page.getByRole('button', { name: 'Resend code' }).click()
  await expect(page.getByText('We sent a new code. Use the latest email.')).toBeVisible()
  const code = await waitForLoginCode(email, { since })
  expect((await messagesTo(email)).length).toBe(2)

  await page.getByLabel('Sign-in code').fill(code)
  await page.waitForURL('**/welcome')
})

test('an expired code offers a new one', async ({ page }) => {
  const email = freshEmail('expired')
  await page.clock.install()
  await requestCode(page, email)
  const stale = await waitForLoginCode(email)

  // Age the code past its 10-minute lifetime on both sides.
  await db()`update auth.users set confirmation_sent_at = now() - interval '11 minutes', recovery_sent_at = now() - interval '11 minutes' where email = ${email}`
  await page.clock.fastForward('11:00')

  await page.getByLabel('Sign-in code').fill(stale)
  await expect(page.getByText('That code has expired.')).toBeVisible()
  await page.getByRole('button', { name: 'Send a new code' }).click()
  await expect(page.getByText('We sent a new code. Use the latest email.')).toBeVisible()
  const fresh = await waitForLoginCode(email, { except: stale })
  await page.getByLabel('Sign-in code').fill(fresh)
  await page.waitForURL('**/welcome')
})

test('asking for another code too soon is rate limited with a wait time', async ({ page }) => {
  const email = freshEmail('rate')
  await requestCode(page, email)
  await page.getByRole('button', { name: 'Use a different email' }).click()
  await expect(page.getByLabel('Email')).toHaveValue(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByText(/Too many attempts\. Try again in \d+ (seconds|minutes)\./)).toBeVisible()
})

test('when the email cannot be sent, the page says so and offers Google', async ({ page }) => {
  const email = freshEmail('nosend')
  // Exhaust the daily email limit: the auth code has nowhere to go.
  const rows = await db()`
    insert into email_outbox (to_email, template, payload, priority, status, attempts, sent_at, send_after)
    select 'quota-' || g || '@pitfund.test', 'notice', '{}'::jsonb, 1, 'sent', 1, now(), now() from generate_series(1, 100) g
    returning id`
  try {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Email me a code' }).click()
    await expect(page.getByText("We couldn't send the email right now. Continue with Google, or try again in a few minutes.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  } finally {
    await db()`delete from email_outbox where id = any(${rows.map((r) => r.id)})`
  }
})

test('Google: the button renders, explains when unavailable, and shows cancel copy', async ({ page }) => {
  await page.goto('/login')
  const google = page.getByRole('button', { name: 'Continue with Google' })
  await expect(google).toBeVisible()
  // Plan §1 rule 10: Google or an email code, never a password.
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== 'true') {
    await google.click()
    await expect(page.getByText("Google sign-in isn't available yet. Use an email code instead.")).toBeVisible()
  }
  await page.goto('/login?error=google_cancelled')
  await expect(page.getByText('Google sign-in was cancelled.')).toBeVisible()
  await page.goto('/auth/callback?error=access_denied&error_description=The+user+denied+access')
  await expect(page).toHaveURL(/\/login\?error=google_cancelled/)
})

test('signs out from the account menu, and signed-out pages go to login and back', async ({ page, problems }) => {
  await page.goto('/api/dev/sign-in?persona=sponsor2')
  await page.waitForURL('**/inbox')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL('**/login?signed_out=1')
  await expect(page.getByText('You’re signed out.')).toBeVisible()

  await page.goto('/company')
  await page.waitForURL(/\/login\?next=%2Fcompany/)
  expect(problems.filter((p) => !p.includes('NEXT_REDIRECT'))).toEqual([])
})
