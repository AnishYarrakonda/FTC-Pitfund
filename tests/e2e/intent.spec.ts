import { asPersona, expect, test } from '../support/fixtures'

/*
 * The landing page's two doors ("I coach a team" / "I represent a company") carry ?intent through
 * sign-in to preselect the /welcome branch, and the landing top bar knows when you're signed in.
 */

test.describe('signed out', () => {
  test('the landing page offers both doors and the sign-in page speaks to each', async ({ page, problems }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Sponsorship pitches companies actually read.' })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Sign in' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/login?intent=team')
    await expect(page.getByRole('link', { name: 'I represent a company' }).first()).toHaveAttribute('href', '/login?intent=company')

    await page.getByRole('link', { name: 'I coach a team' }).first().click()
    await page.waitForURL('**/login?intent=team')
    await expect(page.getByText('Sign in to set up your team. No password needed.')).toBeVisible()

    await page.goto('/login?intent=company')
    await expect(page.getByText('Sign in to set up your company. No password needed.')).toBeVisible()
    await page.goto('/login')
    await expect(page.getByText('Coaches and company teams both sign in here. No password needed.')).toBeVisible()
    expect(problems).toEqual([])
  })
})

test.describe('a first-time visitor who is signed in', () => {
  test.use(asPersona('coach-new'))

  test('lands on /welcome with the branch they chose preselected', async ({ page, problems }) => {
    await page.goto('/login?intent=company')
    await page.waitForURL('**/welcome?intent=company')
    await expect(page.getByRole('radio', { name: /I represent a company/ })).toBeChecked()
    await expect(page.getByRole('radio', { name: /I coach an FTC team/ })).not.toBeChecked()

    await page.goto('/welcome?intent=team')
    await expect(page.getByRole('radio', { name: /I coach an FTC team/ })).toBeChecked()

    await page.goto('/welcome')
    await expect(page.getByRole('radio', { name: /I coach an FTC team/ })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: /I represent a company/ })).not.toBeChecked()
    expect(problems).toEqual([])
  })
})

test.describe('a coach with a team', () => {
  test.use(asPersona('coach'))

  test('goes home from /login whatever the intent, and the landing page offers one way in', async ({ page, problems }) => {
    await page.goto('/login?intent=company')
    await page.waitForURL('**/pitches')

    await page.goto('/', { waitUntil: 'networkidle' })
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Open FTC Pitfund' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
    await nav.getByRole('link', { name: 'Open FTC Pitfund' }).click()
    await page.waitForURL('**/pitches')
    expect(problems).toEqual([])
  })
})
