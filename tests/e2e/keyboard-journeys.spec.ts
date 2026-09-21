import type { Locator, Page } from '@playwright/test'

import { SEED } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { asPersona, expect, test } from '../support/fixtures'
import { waitForLoginCode } from '../support/mailpit'

/*
 * Keyboard-only journeys (prompt 4 §C3): sign in, a coach's composer, and a company's response
 * dialogs, driven with Tab, Enter, Space, arrows and Esc only. Every element is reached by
 * pressing Tab (never clicked or focused directly), every dialog traps focus, closes on Esc and
 * returns focus to what opened it. The admin keyboard review lives in sponsor-admin.spec.ts.
 * Nothing shared is left changed: the composer deletes its own draft, and the company cancels.
 */

test.afterAll(async () => {
  await closeTestDb()
})

/** Presses Tab until `target` has focus; fails if it isn't reachable within `max` presses. */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  await expect(target, `reachable with Tab within ${max} presses`).toBeFocused()
}

/** Tab and Shift+Tab around the dialog more times than it has stops: focus never leaves it. */
async function expectFocusTrapped(page: Page, dialog: Locator) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(key)
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `${key} #${i + 1} stays in the dialog`).toBe(true)
    }
  }
}

test('sign in with the keyboard only: email, Enter, the code field takes focus, typing the code signs in', async ({ page, problems }) => {
  const email = `e2e-keyboard-${Date.now()}@pitfund.test`
  await page.goto('/login?intent=team', { waitUntil: 'networkidle' })

  await tabTo(page, page.getByLabel('Email'))
  await page.keyboard.type(email)
  await page.keyboard.press('Enter')

  const code = page.getByLabel('Sign-in code')
  await expect(code).toBeFocused()
  await page.keyboard.type(await waitForLoginCode(email))
  await page.waitForURL('**/welcome?intent=team')

  // The welcome form works from the keyboard too: the chosen branch is checked, and the name field is reachable.
  await expect(page.getByRole('radio', { name: /I coach an FTC team/ })).toBeChecked()
  await tabTo(page, page.getByLabel('Your name'))
  await page.keyboard.type('Casey Keys')
  await tabTo(page, page.getByRole('checkbox', { name: 'I’m 18 or older' }))
  await page.keyboard.press('Space')
  await expect(page.getByRole('checkbox', { name: 'I’m 18 or older' })).toBeChecked()
  expect(problems).toEqual([])
})

test.describe('a coach', () => {
  test.use(asPersona('coach'))

  test.afterAll(async () => {
    // Belt and braces: the test deletes its draft through the UI; this only runs if it failed midway.
    await db()`delete from pitches where team_id = ${SEED.exodius.id} and sponsor_id = ${SEED.keystone} and status = 'draft'`
  })

  test('writes a pitch with the keyboard only: blockers jump to their question, Submit confirms, Esc returns focus', async ({ page, problems }) => {
    test.setTimeout(90_000)
    await page.goto(`/sponsors/${SEED.keystone}/pitch`, { waitUntil: 'networkidle' })
    const submit = page.getByRole('button', { name: 'Submit for review' })
    await expect(submit).toBeDisabled()

    // Each "Answer question N" blocker moves focus into its answer; type there.
    for (let n = 0; n < 10; n++) {
      const blocker = page.getByRole('button', { name: /^Answer question \d+$/ }).first()
      if (!(await blocker.count())) break
      const label = (await blocker.textContent())!
      await tabTo(page, blocker)
      await page.keyboard.press('Enter')
      await expect(page.locator('textarea:focus'), `${label} focuses its answer`).toHaveCount(1)
      await page.keyboard.type(`A keyboard-only answer for ${label.toLowerCase()}.`)
    }

    // The ask is a radio group: an arrow moves the choice to Amount, which asks for a number.
    const ask = page.getByRole('radiogroup', { name: 'Your ask' })
    await tabTo(page, ask.getByRole('radio', { checked: true }))
    await page.keyboard.press('ArrowRight')
    await expect(ask.getByRole('radio', { name: 'Amount' })).toBeChecked()
    await expect(ask.getByRole('radio', { name: 'Amount' })).toBeFocused()
    await expect(submit).toBeDisabled()
    await tabTo(page, page.getByLabel(/Amount \(USD\)/), 5)
    await page.keyboard.type('2500')
    await expect(page.getByLabel(/Amount \(USD\)/)).toHaveValue('2,500')
    await expect(page.getByText(/Saved · /)).toBeVisible()
    await expect(submit).toBeEnabled()

    // Submit opens the confirmation: focus is inside, trapped, Esc closes it and focus goes back to Submit.
    await tabTo(page, submit)
    await page.keyboard.press('Enter')
    const confirm = page.getByRole('dialog', { name: 'Send this pitch to BioBuzz Foundation for review?' })
    await expect(confirm).toBeVisible()
    expect(await confirm.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await expectFocusTrapped(page, confirm)
    await page.keyboard.press('Escape')
    await expect(confirm).toBeHidden()
    await expect(submit).toBeFocused()

    // Clean up with the keyboard too: Delete draft → confirm.
    const deleteDraft = page.getByRole('button', { name: 'Delete draft' })
    await tabTo(page, deleteDraft)
    await page.keyboard.press('Enter')
    const del = page.getByRole('dialog', { name: 'Delete this draft?' })
    await expect(del).toBeVisible()
    await tabTo(page, del.getByRole('button', { name: 'Delete draft' }), 10)
    await page.keyboard.press('Enter')
    await expect(del).toBeHidden()
    await expect.poll(async () => (await db()`select id from pitches where team_id = ${SEED.exodius.id} and sponsor_id = ${SEED.keystone}`).length).toBe(0)
    expect(problems).toEqual([])
  })
})

test.describe('a company', () => {
  test.use(asPersona('sponsor'))

  test('answers from the keyboard only: both response dialogs trap focus, Esc and Cancel return it, nothing is sent', async ({ page, problems }) => {
    await page.goto(`/inbox/${SEED.pitches.voltageToRibosomeSent}`, { waitUntil: 'networkidle' })
    const notAFit = page.getByRole('button', { name: 'Not a fit' })
    const interested = page.getByRole('button', { name: 'Interested' })

    // Not a fit: choose a reason with arrows; "Other" reveals the note and focuses it.
    await tabTo(page, notAFit)
    await page.keyboard.press('Enter')
    const decline = page.getByRole('dialog', { name: 'Mark this pitch not a fit?' })
    await expect(decline).toBeVisible()
    await tabTo(page, decline.getByRole('radio').first(), 10)
    await page.keyboard.press('Space')
    await expect(decline.getByRole('radio', { name: 'Not aligned with our focus' })).toBeChecked()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    await expect(decline.getByRole('radio', { name: 'Other' })).toBeChecked()
    await expect(decline.getByLabel(/Tell the team why/)).toBeFocused()
    await page.keyboard.type('Typed, never sent.')
    await expectFocusTrapped(page, decline)
    await page.keyboard.press('Escape')
    await expect(decline).toBeHidden()
    await expect(notAFit).toBeFocused()

    // Interested: Cancel with Enter closes it and focus returns to Interested.
    await tabTo(page, interested, 5)
    await page.keyboard.press('Enter')
    const connect = page.getByRole('dialog', { name: /^Connect with / })
    await expect(connect).toBeVisible()
    await expectFocusTrapped(page, connect)
    await tabTo(page, connect.getByRole('button', { name: 'Cancel' }), 10)
    await page.keyboard.press('Enter')
    await expect(connect).toBeHidden()
    await expect(interested).toBeFocused()

    const [row] = await db()`select status from pitches where id = ${SEED.pitches.voltageToRibosomeSent}`
    expect(row.status).toBe('sent')
    expect(problems).toEqual([])
  })
})

test.describe('the top bar', () => {
  test.use(asPersona('coach'))

  test('keeps keyboard focus on the bell and the account menu when their code arrives, and Enter opens them', async ({ page }) => {
    await page.goto('/pitches', { waitUntil: 'networkidle' })
    for (const [name, role] of [
      [/^Needs your attention/, 'dialog'],
      ['Account menu', 'menu'],
    ] as const) {
      const trigger = page.getByRole('button', { name })
      await tabTo(page, trigger)
      // The lookalike button is swapped for the real one when its chunk loads; focus used to fall to <body>.
      await page.waitForTimeout(500)
      await expect(trigger).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole(role).first()).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole(role)).toHaveCount(0)
    }
  })
})
