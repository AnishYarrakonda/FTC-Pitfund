import { PROD_URL } from '../support/env'
import { asPersona, expect, test } from '../support/fixtures'

/*
 * The feedback contract (plan §3.1) on real screens: notification bell, network failure with
 * Retry, loading skeletons on slow navigation, persona switching from /dev.
 */

test.describe('notifications', () => {
  test.use(asPersona('coach'))
  test('the bell lists only what needs doing, and an item clears when it is done', async ({ page, problems }) => {
    await page.goto('/pitches')
    // The badge counts work, not events: "Sam Patel joined the team" is news and never appears here.
    const bell = page.getByRole('button', { name: /Needs your attention, \d+ items?/ })
    await expect(bell).toBeVisible()
    await bell.click()
    const panel = page.getByRole('dialog', { name: 'Needs your attention' })
    const first = panel.getByRole('listitem').first()
    await expect(first).toBeVisible()
    // There is no "Mark all read": an action item is cleared by doing it, so following the link is
    // the only way out of the list.
    await expect(panel.getByRole('button', { name: 'Mark all read' })).toHaveCount(0)
    await first.getByRole('link').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /^Needs your attention/ })).toBeVisible()
    expect(problems).toEqual([])
  })
})

test('a network failure says "Couldn’t reach FTC Pitfund" and Retry recovers', async ({ page, context }) => {
  // networkidle: the toast code is fetched once the page is idle, so it can show while offline.
  await page.goto('/dev/ui#actions', { waitUntil: 'networkidle' })
  const button = page.getByRole('button', { name: 'Approve & send' })
  await button.scrollIntoViewIfNeeded()
  await context.setOffline(true)
  await button.click()
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: "Couldn't reach FTC Pitfund. Check your connection." })
  await expect(toast).toBeVisible()
  await context.setOffline(false)
  await toast.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('button', { name: 'Sent' })).toBeVisible({ timeout: 10_000 })
})

test('an ActionButton acknowledges the click in the same frame and ignores double clicks', async ({ page }) => {
  // Wait for hydration: a click before it is replayed by React and would measure load time.
  await page.goto('/dev/ui#actions', { waitUntil: 'networkidle' })
  const button = page.getByRole('button', { name: 'Resend invite' })
  await button.scrollIntoViewIfNeeded()
  const latency = await button.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        const start = performance.now()
        const observer = new MutationObserver(() => {
          if (el.getAttribute('aria-busy') === 'true') {
            observer.disconnect()
            resolve(performance.now() - start)
          }
        })
        observer.observe(el, { attributes: true, childList: true, subtree: true })
        ;(el as HTMLButtonElement).click()
        ;(el as HTMLButtonElement).click()
      }),
  )
  expect(latency).toBeLessThan(100)
  await expect(page.getByText('Invite sent to jane@example.com')).toHaveCount(1)
})

test.describe('slow navigation', () => {
  test.use(asPersona('coach'))
  // Production build: `next dev` doesn't prefetch, so loading.tsx would arrive with the slow response.
  // Primary nav links are fully prefetched (instant); the Account menu link gets the static shell
  // with its loading.tsx, so delaying only the real navigation request shows the skeleton.
  test('shows a layout-shaped skeleton while the page loads', async ({ page }) => {
    await page.goto(`${PROD_URL}/pitches`, { waitUntil: 'networkidle' })
    await page.route(/\/account(\?|$)/, async (route) => {
      if (!route.request().headers()['next-router-prefetch']) await new Promise((r) => setTimeout(r, 2500))
      await route.continue()
    })
    await page.getByRole('button', { name: 'Account menu' }).click()
    const account = page.getByRole('menuitem', { name: 'Account' })
    await expect(account).toBeVisible()
    await page.waitForLoadState('networkidle')
    await account.click()
    await expect(page.getByRole('status', { name: 'Loading' })).toBeVisible()
    await page.waitForURL('**/account')
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible()
  })
})

test('the /dev persona switcher signs in and lands on the persona home', async ({ page }) => {
  await page.goto('/dev')
  await page.getByRole('button', { name: 'Sign in as Daniel Brooks' }).click()
  await page.waitForURL('**/inbox')
  await page.goto('/dev')
  await expect(page.getByText('Signed in as sponsor@pitfund.test')).toBeVisible()
  await page.getByRole('button', { name: 'Sign in as Avery Admin' }).click()
  await page.waitForURL('**/admin')
})
