import { asPersona, expect, test } from '../support/fixtures'
import { PROD_URL } from '../support/env'

/* Smoke test of workspace isolation at the page level, and of dev tools in production. */

test.describe('coach', () => {
  test.use(asPersona('coach'))
  test('is sent home from sponsor and admin pages', async ({ page }) => {
    for (const path of ['/inbox', '/company', '/admin', '/admin/system']) {
      await page.goto(path)
      await page.waitForURL('**/pitches')
    }
  })
})

test.describe('sponsor', () => {
  test.use(asPersona('sponsor'))
  test('is sent home from team pages', async ({ page }) => {
    for (const path of ['/pitches', '/sponsors', '/team', '/welcome']) {
      await page.goto(path)
      await page.waitForURL('**/inbox')
    }
  })
})

test.describe('pending company member', () => {
  test.use(asPersona('sponsor-pending'))
  test('sees the waiting-for-approval banner', async ({ page }) => {
    await page.goto('/inbox')
    await expect(page.getByText('Atlas Components is waiting for approval')).toBeVisible()
  })
})

test.describe('person with no team or company', () => {
  test.use(asPersona('coach-new'))
  test('is sent to /welcome from every workspace page', async ({ page }) => {
    for (const path of ['/pitches', '/inbox', '/team']) {
      await page.goto(path)
      await page.waitForURL('**/welcome')
    }
  })
})

test('signed-out visitors are sent to login with a return path', async ({ page }) => {
  await page.goto('/team')
  await page.waitForURL(/\/login\?next=%2Fteam$/)
  await page.goto('/admin/directory')
  await page.waitForURL(/\/login\?next=%2Fadmin%2Fdirectory$/)
})

test('dev tools do not exist in a production build', async ({ request }) => {
  for (const path of ['/dev', '/dev/ui', '/api/dev/sign-in?persona=admin']) {
    const res = await request.get(`${PROD_URL}${path}`, { maxRedirects: 0 })
    expect(res.status(), path).toBe(404)
  }
  const login = await request.get(`${PROD_URL}/login`)
  expect(login.status()).toBe(200)
})
