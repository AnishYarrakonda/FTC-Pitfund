import { closeTestDb, db } from '../support/db'
import { asPersona, expect, test } from '../support/fixtures'

/*
 * The team finder on /welcome/team: type a number, a name or a city; each box suggests teams from
 * FIRST's list and fills the other; a team FIRST doesn't list can't be created. The directory is
 * seeded here (the real one is copied from FIRST by the weekly job).
 */

test.afterAll(async () => {
  await closeTestDb()
})

test.describe('team finder', () => {
  test.use(asPersona('coach-new'))

  const seedTeam = async (number: number, name: string, city = 'Boise', fullName: string | null = null) => {
    await db()`insert into ftc_team_cache (number, name, full_name, city, state, country, source, fetched_at)
      values (${number}, ${name}, ${fullName}, ${city}, 'ID', 'USA', 'first', now())
      on conflict (number) do update set name = excluded.name, full_name = excluded.full_name, city = excluded.city, fetched_at = now()`
  }

  test('typing part of a name suggests teams, and picking one fills the number and the details', async ({ page, problems }) => {
    const number = 700_000 + Math.floor(Math.random() * 99_999)
    await seedTeam(number, 'Zyxwvutsr Robotics', 'Twin Falls', 'Snake River Robotics Club')
    await page.goto('/welcome/team', { waitUntil: 'networkidle' })

    const byName = page.getByRole('combobox', { name: 'Search by name' })
    await byName.fill('zyxwvuts')
    const option = page.getByRole('option', { name: new RegExp(`${number} · Zyxwvutsr Robotics`) })
    await expect(option).toBeVisible()
    // A spelling slip still finds it.
    await byName.fill('zyxwvutzr robotcs')
    await expect(option).toBeVisible()

    await byName.press('ArrowDown')
    await expect(option).toHaveAttribute('aria-selected', 'true')
    await byName.press('Enter')
    await expect(page.getByRole('combobox', { name: 'FTC team number' })).toHaveValue(String(number))
    await expect(byName).toHaveValue('Zyxwvutsr Robotics')
    // Picking is the confirmation: the details are already there.
    await expect(page.getByLabel('Team name')).toHaveValue('Zyxwvutsr Robotics')
    await expect(page.getByLabel('Location')).toHaveValue('Twin Falls, ID, USA')
    expect(problems).toEqual([])
  })

  test('typing a team number fills the name, and editing one box clears the other', async ({ page, problems }) => {
    const number = 700_000 + Math.floor(Math.random() * 99_999)
    await seedTeam(number, 'Quorvex Bots')
    await page.goto('/welcome/team', { waitUntil: 'networkidle' })

    const byNumber = page.getByRole('combobox', { name: 'FTC team number' })
    const byName = page.getByRole('combobox', { name: 'Search by name' })
    await byNumber.fill(String(number))
    await expect(byName).toHaveValue('Quorvex Bots')
    await expect(page.getByText(`Team ${number} · Quorvex Bots`)).toBeVisible()
    await expect(page.getByRole('listbox')).toHaveCount(0)

    await byName.fill('Quorvex Bot')
    await expect(byNumber).toHaveValue('')
    await expect(page.getByText('Is this your team?')).toHaveCount(0)
    expect(problems).toEqual([])
  })

  test('typing a full name that is exactly one team fills its number', async ({ page }) => {
    const number = 700_000 + Math.floor(Math.random() * 99_999)
    await seedTeam(number, 'Vlorpnax Engineering')
    await page.goto('/welcome/team', { waitUntil: 'networkidle' })
    await page.getByRole('combobox', { name: 'Search by name' }).fill('vlorpnax engineering')
    await expect(page.getByRole('combobox', { name: 'FTC team number' })).toHaveValue(String(number))
    await expect(page.getByText(`Team ${number} · Vlorpnax Engineering`)).toBeVisible()
  })

  test('a team already on FTC Pitfund is marked, and picking it offers to join', async ({ page }) => {
    await page.goto('/welcome/team', { waitUntil: 'networkidle' })
    await page.getByRole('combobox', { name: 'Search by name' }).fill('exodi')
    await expect(page.getByRole('option', { name: /31579 · Exodius/ })).toContainText('On FTC Pitfund')
    await page.getByRole('option', { name: /31579 · Exodius/ }).click()
    await expect(page.getByRole('button', { name: 'Request to join' })).toBeVisible()
  })

  test('a number FIRST does not list is refused with no way to continue', async ({ page, context }) => {
    await page.goto('/welcome/team', { waitUntil: 'networkidle' })
    await context.addCookies([{ name: 'pitfund-simulate', value: 'ftc-not-found', domain: new URL(page.url()).hostname, path: '/' }])
    await page.getByRole('combobox', { name: 'FTC team number' }).fill('612345')
    await expect(page.getByText('FIRST doesn’t list an FTC team 612345, so it can’t sign up here.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Enter details/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create team' })).toHaveCount(0)
  })

  test('nothing matches: the box says so', async ({ page }) => {
    await page.goto('/welcome/team', { waitUntil: 'networkidle' })
    await page.getByRole('combobox', { name: 'Search by name' }).fill('qqqqxxxxzzzz')
    await expect(page.getByText('No FIRST team matches that.')).toBeVisible()
  })
})
