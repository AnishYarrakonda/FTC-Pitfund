import type { Locator, Page } from '@playwright/test'

import { SEED } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { PROD_URL } from '../support/env'
import { asPersona, expect, test } from '../support/fixtures'

/*
 * Phone usability at 375 px (prompt 4 §C6), beyond "nothing overflows" (the QA gate checks that):
 * the composer, the admin review, the company inbox and the PDF viewer are driven with taps on a
 * touch device. Every control used must be on screen, at least 32 px tall, inside the viewport and
 * not covered by a sticky bar at the point a finger lands. Dialogs fit the screen and close.
 * Nothing is submitted, so the seeded world is unchanged. Runs on the production build: that is what a phone gets,
 * and the dev server's "Rendering…" indicator would sit over the sticky response bar.
 */

const PHONE = { baseURL: PROD_URL, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true }

test.afterAll(async () => {
  await closeTestDb()
})

/**
 * Scrolls the control into view and checks a tap on the centre of its hit area lands on it. `area` is the box a
 * finger can hit when it is bigger than the element (a row whose link is stretched over it with `::after`).
 */
async function expectTappable(page: Page, control: Locator, area: Locator = control) {
  await control.scrollIntoViewIfNeeded()
  const box = await area.boundingBox()
  expect(box, 'the control is rendered').not.toBeNull()
  const { x, y, width, height } = box!
  const viewport = page.viewportSize()!
  expect(height, 'tall enough to tap').toBeGreaterThanOrEqual(32)
  expect(x, 'starts inside the screen').toBeGreaterThanOrEqual(0)
  expect(x + width, 'ends inside the screen').toBeLessThanOrEqual(viewport.width)
  const landsOnIt = await control.evaluate((el, [cx, cy]) => {
    const hit = document.elementFromPoint(cx, cy)
    return Boolean(hit && (el === hit || el.contains(hit)))
  }, [x + width / 2, y + height / 2])
  expect(landsOnIt, 'nothing covers it where a finger lands').toBe(true)
}

async function expectFitsScreen(page: Page, dialog: Locator) {
  const box = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
}

test.describe('a coach on a phone', () => {
  test.use({ ...asPersona('coach'), ...PHONE })

  test('the composer: Write and Preview switch, a blocker jumps to its answer, Submit and Delete draft are tappable', async ({ page, problems }) => {
    await page.goto(`/sponsors/${SEED.summit}/pitch`, { waitUntil: 'networkidle' })
    const [before] = await db()`select answers, updated_at from pitches where id = ${SEED.pitches.exodiusDraft}`

    const show = page.getByRole('radiogroup', { name: 'Show' })
    await expectTappable(page, show.getByRole('radio', { name: 'Preview' }))
    await show.getByRole('radio', { name: 'Preview' }).tap()
    await expect(page.getByRole('complementary', { name: 'Preview' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Questions' })).toBeHidden()
    await show.getByRole('radio', { name: 'Write' }).tap()
    await expect(page.getByRole('region', { name: 'Questions' })).toBeVisible()

    // A blocker tap takes the coach to the question it names, with the keyboard up (focus in the answer).
    const blocker = page.getByRole('button', { name: /^Answer question \d+$/ }).first()
    await expectTappable(page, blocker)
    await blocker.tap()
    await expect(page.locator('textarea:focus')).toHaveCount(1)
    await expect(page.locator('textarea:focus')).toBeInViewport()

    await expectTappable(page, page.getByRole('button', { name: 'Submit for review' }))
    await expectTappable(page, page.getByRole('button', { name: 'Delete draft' }))

    // Nothing was typed, so nothing was saved.
    const [after] = await db()`select answers, updated_at from pitches where id = ${SEED.pitches.exodiusDraft}`
    expect(after).toEqual(before)
    expect(problems).toEqual([])
  })
})

test.describe('an admin on a phone', () => {
  test.use({ ...asPersona('admin'), ...PHONE })

  test('the review page: the pitch reads, all three decisions are tappable, and the note dialog fits and closes', async ({ page, problems }) => {
    await page.goto(`/admin/pitches/${SEED.pitches.lotusToRibosomeInReview}`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectTappable(page, page.getByRole('button', { name: /Approve & send/ }))
    await expectTappable(page, page.getByRole('button', { name: /^Reject/ }))
    const sendBack = page.getByRole('button', { name: /^Send back/ })
    await expectTappable(page, sendBack)

    await sendBack.tap()
    const dialog = page.getByRole('dialog', { name: /^Send back to Team/ })
    await expect(dialog).toBeVisible()
    await expectFitsScreen(page, dialog)
    await expectTappable(page, dialog.getByRole('textbox'))
    const cancel = dialog.getByRole('button', { name: 'Cancel' })
    await expectTappable(page, cancel)
    await cancel.tap()
    await expect(dialog).toBeHidden()

    const [row] = await db()`select status from pitches where id = ${SEED.pitches.lotusToRibosomeInReview}`
    expect(row.status).toBe('in_review')
    expect(problems).toEqual([])
  })
})

test.describe('a company on a phone', () => {
  test.use({ ...asPersona('sponsor'), ...PHONE })

  test('the inbox: the pitch reads, the sticky response bar is tappable, and Not a fit fits the screen', async ({ page, problems }) => {
    await page.goto('/inbox', { waitUntil: 'networkidle' })
    // The whole row is the target: its link is stretched over it.
    const link = page.locator(`a[href="/inbox/${SEED.pitches.voltageToRibosomeSent}"]`)
    await expectTappable(page, link, link.locator('xpath=ancestor::div[contains(@class, "group")][1]'))
    await link.tap()
    await page.waitForURL(`**/inbox/${SEED.pitches.voltageToRibosomeSent}`)
    await page.waitForLoadState('networkidle')

    const notAFit = page.getByRole('button', { name: 'Not a fit' })
    await expectTappable(page, notAFit)
    await expectTappable(page, page.getByRole('button', { name: 'Interested' }))
    await notAFit.tap()
    const dialog = page.getByRole('dialog', { name: 'Mark this pitch not a fit?' })
    await expect(dialog).toBeVisible()
    await expectFitsScreen(page, dialog)
    const other = dialog.getByRole('radio', { name: 'Other' })
    await expectTappable(page, other)
    await other.tap()
    await expect(dialog.getByLabel(/Tell the team why/)).toBeVisible()
    await expectFitsScreen(page, dialog)
    const cancel = dialog.getByRole('button', { name: 'Cancel' })
    await expectTappable(page, cancel)
    await cancel.tap()
    await expect(dialog).toBeHidden()

    const [row] = await db()`select status from pitches where id = ${SEED.pitches.voltageToRibosomeSent}`
    expect(row.status).toBe('sent')
    expect(problems).toEqual([])
  })
})

test.describe('anyone on a phone', () => {
  test.use(PHONE)

  test('the PDF viewer: pages render at the screen width and the page buttons and download are tappable', async ({ page, problems }) => {
    await page.goto('/t/31579', { waitUntil: 'networkidle' })
    const download = page.getByRole('link', { name: 'Download PDF' })
    await download.scrollIntoViewIfNeeded()
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible({ timeout: 30_000 })
    const box = (await canvas.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    expect(box.width, 'a page uses most of the screen, not a thumbnail').toBeGreaterThan(300)

    await expect(page.getByText(/Page 1 of 4/)).toBeVisible()
    const next = page.getByRole('button', { name: 'Next page' })
    await expectTappable(page, next)
    await next.tap()
    await expect(page.getByText(/Page 2 of 4/)).toBeVisible()
    await expectTappable(page, page.getByRole('button', { name: 'Previous page' }))
    await expectTappable(page, download)
    expect(problems).toEqual([])
  })
})
