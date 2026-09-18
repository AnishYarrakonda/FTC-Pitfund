import { PERSONAS } from '../../lib/shared/personas'
import { asPersona, expect, test } from '../support/fixtures'

/* Every persona lands in the right shell with the right navigation (plan §2). */

const NAV: Record<string, string[]> = {
  '/pitches': ['Pitches', 'Sponsors', 'Team'],
  '/inbox': ['Pitches', 'Company'],
  '/admin': ['Review', 'Directory', 'System'],
  '/welcome': [],
  // An org waiting for review has no workspace to navigate: every link would bounce it back here.
  '/welcome/pending': [],
}

for (const persona of PERSONAS) {
  test(`${persona.key} lands on ${persona.home}`, async ({ page, problems }) => {
    await page.goto(`/api/dev/sign-in?persona=${persona.key}`)
    await page.waitForURL(`**${persona.home}`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Main' })
    const expected = NAV[persona.home]
    if (expected.length === 0) {
      await expect(nav).toHaveCount(0)
    } else {
      await expect(nav.getByRole('link')).toHaveText(expected)
      await expect(nav.getByRole('link', { name: expected[0] })).toHaveAttribute('aria-current', 'page')
    }
    // Admin area has no bell; the app area does.
    await expect(page.getByRole('button', { name: /^Needs your attention/ })).toHaveCount(persona.home === '/admin' ? 0 : 1)
    expect(problems).toEqual([])
  })
}

test.describe('as the admin', () => {
  test.use(asPersona('admin'))
  test('can move between the three admin pages', async ({ page, problems }) => {
    await page.goto('/admin')
    for (const [label, path] of [['Directory', '/admin/directory'], ['System', '/admin/system'], ['Review', '/admin']]) {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }).click()
      await page.waitForURL(`**${path}`)
      await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible()
    }
    expect(problems).toEqual([])
  })
})

test.describe('on a phone', () => {
  test.use({ ...asPersona('coach'), viewport: { width: 375, height: 812 } })
  test('the nav collapses into a bottom menu sheet', async ({ page }) => {
    await page.goto('/pitches')
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
    await page.getByRole('button', { name: 'Open menu' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await sheet.getByRole('link', { name: 'Team' }).click()
    await page.waitForURL('**/team')
    await expect(sheet).toBeHidden()
  })
})
