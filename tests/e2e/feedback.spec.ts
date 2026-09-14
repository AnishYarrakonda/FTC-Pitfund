import { asPersona, expect, test } from '../support/fixtures'

/*
 * The feedback contract (plan §3.1) on real screens: notification bell, network failure with
 * Retry, loading skeletons on slow navigation, persona switching from /dev.
 */

test.describe('notifications', () => {
  test.use(asPersona('coach'))
  test('the bell lists notifications and marks them read optimistically', async ({ page, problems }) => {
    await page.goto('/pitches')
    const bell = page.getByRole('button', { name: /Notifications, \d+ unread/ })
    await expect(bell).toBeVisible()
    await bell.click()
    const panel = page.getByRole('dialog', { name: 'Notifications' })
    await expect(panel.getByRole('listitem').first()).toBeVisible()
    await panel.getByRole('button', { name: 'Mark all read' }).click()
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
    expect(problems).toEqual([])
  })
})

test('a network failure says "Couldn’t reach FTC Pitfund" and Retry recovers', async ({ page, context }) => {
  await page.goto('/dev/ui#actions')
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
  test('shows a layout-shaped skeleton while the page loads', async ({ page }) => {
    await page.goto('/pitches')
    await page.route(/\/account(\?|$)/, async (route) => {
      await new Promise((r) => setTimeout(r, 2500))
      await route.continue()
    })
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Account' }).click()
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
