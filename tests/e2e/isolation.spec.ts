import { SEED, seedPitchId } from '../../scripts/seed/ids'
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

test.describe('coach pitch isolation and the season rule', () => {
  test.use(asPersona('coach-unverified'))
  test('another team’s pitch or draft is a 404, and its answers never leak into my composer', async ({ page }) => {
    for (const id of [SEED.pitches.exodiusDraft, SEED.pitches.exodiusMatched]) {
      await page.goto(`/pitches/${id}`)
      await expect(page.getByRole('heading', { name: 'We couldn\'t find that page' })).toBeVisible()
    }
    // Exodius has a Summit draft; this team's own Summit pitch (matched) opens instead.
    await page.goto(`/sponsors/${SEED.summit}/pitch`)
    await page.waitForURL(`**/pitches/${seedPitchId(24890, 'Summit Fabrication')}`)
    await expect(page.getByText(/6061 aluminum/)).toHaveCount(0)
    // Pending companies are invisible to coaches.
    await page.goto(`/sponsors/${SEED.atlasPending}`)
    await expect(page.getByRole('heading', { name: 'We couldn\'t find that page' })).toBeVisible()
  })
})

test.describe('coach composer states', () => {
  test.use(asPersona('coach'))
  test('a pitched company opens its pitch; a changed question set is explained', async ({ page }) => {
    await page.goto(`/sponsors/${SEED.brightline}/pitch`)
    await page.waitForURL(`**/pitches/${SEED.pitches.exodiusMatched}`)
    await expect(page.getByRole('heading', { name: 'Connected with Brightline Engineering' })).toBeVisible()
    await expect(page.getByText('We emailed you both. Reach out and take it from here.')).toBeVisible()

    await page.goto(`/sponsors/${SEED.summit}/pitch`)
    await expect(page.getByText('Summit Fabrication updated its questions')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled()

    await page.goto(`/sponsors/${SEED.northpeak}/pitch`)
    await expect(page.getByText('A reviewer sent this pitch back')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit and resubmit Northpeak Software' })).toBeVisible()
  })
})
