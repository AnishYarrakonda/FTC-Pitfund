import { closeTestDb, db } from '../support/db'
import { asPersona, expect, test } from '../support/fixtures'
import { waitForLoginCode } from '../support/mailpit'

test.afterAll(async () => {
  await closeTestDb()
})

test.describe('welcome', () => {
  test.use(asPersona('coach-new'))

  test('requires a role, 18+ and terms, then hands off to team setup', async ({ page, problems }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('heading', { name: 'Welcome to FTC Pitfund' })).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Choose how you’ll use FTC Pitfund')).toBeVisible()
    await expect(page.getByText('Confirm that you’re 18 or older')).toBeVisible()
    await expect(page.getByText('Accept the Terms and Privacy Policy to continue')).toBeVisible()

    await page.getByRole('radio', { name: /I coach an FTC team/ }).click()
    await page.getByRole('checkbox', { name: 'I’m 18 or older' }).click()
    await page.getByRole('checkbox', { name: /I accept the Terms/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/welcome/team')
    await expect(page.getByRole('heading', { name: 'Set up your team' })).toBeVisible()

    // Going back keeps what was already answered; only the role changes.
    await page.getByRole('link', { name: 'Back' }).click()
    await page.waitForURL(/\/welcome$/)
    await expect(page.getByRole('checkbox', { name: 'I’m 18 or older' })).toBeChecked()
    await page.getByRole('radio', { name: /I represent a company/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/welcome/company')
    await expect(page.getByRole('heading', { name: 'Set up your company' })).toBeVisible()
    expect(problems).toEqual([])
  })
})

test.describe('join request waiting screen', () => {
  test.use(asPersona('coach-joiner'))
  test('shows the request and can cancel it', async ({ page }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('heading', { name: /Request sent to Team 31579 · Exodius/ })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel request' }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel your request?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel request' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome to FTC Pitfund' })).toBeVisible()
    // Put the seeded request back for later tests and QA.
    await db()`update team_join_requests set status = 'pending', decided_at = null
      where user_id = (select id from users where email = 'coach-joiner@pitfund.test') and status = 'cancelled'`
  })
})

test.describe('account', () => {
  test.use(asPersona('sponsor2'))

  test('edits name, phone and job title with validation and in-place success', async ({ page, problems }) => {
    await page.goto('/account')
    const name = page.getByLabel('Name')
    const phone = page.getByLabel('Phone')
    await expect(page.getByLabel('Email')).toHaveValue('sponsor2@pitfund.test')
    await expect(page.getByLabel('Email')).not.toBeEditable()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await phone.fill('call me maybe')
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Enter a phone number with digits, spaces, dashes or parentheses')).toBeVisible()

    await name.fill('Elena García')
    await phone.fill('(614) 555-0110')
    await page.getByLabel('Job title').fill('Marketing Director')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Name')).toHaveValue('Elena García')
    await expect(page.getByLabel('Phone')).toHaveValue('(614) 555-0110')
    expect(problems).toEqual([])
  })
})

test.describe('account deletion', () => {
  test.use(asPersona('coach2'))
  test('is blocked for the last member of a team, with an explanation', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByText('You can’t delete your account yet')).toBeVisible()
    await expect(page.getByText(/You're the only member of Team 24890 · Voltage Vultures/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete account' })).toBeDisabled()
  })
})

test('a person with no team can delete their account', async ({ page }) => {
  const email = `e2e-delete-${Date.now()}@pitfund.test`
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('Sign-in code').fill(await waitForLoginCode(email, { since }))
  await page.waitForURL('**/welcome')

  await page.goto('/account')
  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' })
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await page.waitForURL('**/login?deleted=1')
  await expect(page.getByText('Your account was deleted.')).toBeVisible()
  const rows = await db()`select 1 from users where email = ${email} union all select 1 from auth.users where email = ${email}`
  expect(rows.length).toBe(0)
})
