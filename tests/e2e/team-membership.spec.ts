import type { Browser, Page } from '@playwright/test'

import { SUPPORT_EMAIL } from '../../lib/shared/brand'
import type { PersonaKey } from '../../lib/shared/personas'
import { SEED, SEED_INVITE_TOKENS } from '../../scripts/seed/ids'
import { closeTestDb, db } from '../support/db'
import { expect, test, watchProblems } from '../support/fixtures'
import { messagesTo } from '../support/mailpit'
import { authFile } from '../support/session'

/*
 * Plan §10 journey 6: joining a team by request and by invite, including the wrong-email case.
 * Every test puts the seeded memberships, requests and invites back the way it found them.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

async function pageAs(browser: Browser, persona: PersonaKey | null): Promise<Page> {
  const context = await browser.newContext(persona ? { storageState: authFile(persona) } : {})
  return context.newPage()
}

/** Back to the seed: coach-joiner has no team and one pending request to Exodius. */
async function restoreJoinerRequest() {
  const joiner = db()`(select id from users where email = 'coach-joiner@pitfund.test')`
  await db()`delete from team_members where user_id = ${joiner}`
  await db()`delete from team_join_requests where user_id = ${joiner}`
  await db()`insert into team_join_requests (team_id, user_id, status, created_at)
    values (${SEED.exodius.id}, ${joiner}, 'pending', now() - interval '2 hours')`
}

test.afterAll(async () => {
  await restoreJoinerRequest()
  await closeTestDb()
})

test('a coach asks to join Exodius from team setup and a member approves', async ({ browser }) => {
  // Start from a person with no request, so the whole path runs through the UI.
  await db()`update team_join_requests set status = 'cancelled', decided_at = now()
    where user_id = (select id from users where email = 'coach-joiner@pitfund.test') and status = 'pending'`

  const joiner = await pageAs(browser, 'coach-joiner')
  const joinerProblems = watchProblems(joiner)
  await joiner.goto('/welcome/team')
  await joiner.getByLabel('FTC team number').fill('31579')
  await expect(joiner.getByText('This team is already on FTC Pitfund. Ask to join it, and one of its coaches can approve you.')).toBeVisible()
  await joiner.getByRole('button', { name: 'Request to join' }).click()
  await joiner.waitForURL(/\/welcome$/)
  await expect(joiner.getByRole('heading', { name: /Request sent to Team 31579 · Exodius/ })).toBeVisible()
  await expect.poll(async () => (await messagesTo('coach@pitfund.test')).some((m) => m.Subject === 'Sam Patel wants to join Team 31579'), { timeout: 20_000 }).toBe(true)

  const coach = await pageAs(browser, 'coach')
  const coachProblems = watchProblems(coach)
  await coach.goto('/team')
  const requests = coach.getByRole('region', { name: 'Join requests' })
  await expect(requests.getByText('Sam Patel (coach-joiner@pitfund.test) wants to join')).toBeVisible()
  await requests.getByRole('button', { name: 'Approve' }).click()
  // The outcome is a toast that decays; the row disappearing is the lasting answer.
  await expect(coach.locator('[data-sonner-toast]').filter({ hasText: 'Sam Patel joined the team.' })).toBeVisible()
  await expect(requests).toHaveCount(0)
  await expect(coach.locator('#members').getByText('coach-joiner@pitfund.test', { exact: true })).toBeVisible()
  await expect.poll(async () => (await messagesTo('coach-joiner@pitfund.test')).some((m) => m.Subject === 'You\'re on Team 31579 · Exodius'), { timeout: 20_000 }).toBe(true)

  await joiner.goto('/welcome')
  await joiner.waitForURL('**/pitches')
  expect([...joinerProblems, ...coachProblems]).toEqual([])
  await joiner.context().close()
  await coach.context().close()
  await restoreJoinerRequest()
})

test('declining a request says so and clears the row', async ({ browser }) => {
  const coach = await pageAs(browser, 'coach')
  await coach.goto('/team')
  const requests = coach.getByRole('region', { name: 'Join requests' })
  await requests.getByRole('button', { name: 'Decline' }).click()
  await expect(coach.locator('[data-sonner-toast]').filter({ hasText: 'Declined. We’ll let Sam Patel know.' })).toBeVisible()
  await expect(requests).toHaveCount(0)
  const [row] = await db()`select status from team_join_requests where user_id = (select id from users where email = 'coach-joiner@pitfund.test') order by created_at desc limit 1`
  expect(row.status).toBe('declined')
  await coach.context().close()
  await restoreJoinerRequest()
})

test('invites: send by email, wrong email is refused, revoke kills the link', async ({ browser }) => {
  const invitee = `e2e-invitee-${Date.now()}@pitfund.test`
  const coach = await pageAs(browser, 'coach')
  const problems = watchProblems(coach)
  await coach.goto('/team')
  await coach.getByRole('button', { name: 'Invite by email' }).click()
  const dialog = coach.getByRole('dialog', { name: 'Invite a coach' })
  await dialog.getByRole('button', { name: 'Send invite' }).click()
  await expect(dialog.getByText('Enter an email address')).toBeVisible()
  await dialog.getByLabel('Email address').fill('member-exodius@pitfund.test')
  await dialog.getByRole('button', { name: 'Send invite' }).click()
  await expect(dialog.getByText('member-exodius@pitfund.test is already a member.')).toBeVisible()
  await dialog.getByLabel('Email address').fill(invitee)
  await dialog.getByRole('button', { name: 'Send invite' }).click()
  await expect(dialog).toBeHidden()
  await expect(coach.locator('#members').getByText(invitee, { exact: true })).toBeVisible()

  let link = ''
  await expect
    .poll(
      async () => {
        const [message] = await messagesTo(invitee)
        if (!message) return false
        const body = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as { Text: string }
        link = body.Text.match(/https?:\/\/\S+\/invite\/[A-Za-z0-9_-]+/)?.[0] ?? ''
        return Boolean(link)
      },
      { timeout: 20_000 },
    )
    .toBe(true)
  const invitePath = new URL(link).pathname
  // The token is only in the email: the outbox row is scrubbed after sending.
  const [row] = await db()`select payload from email_outbox where to_email = ${invitee} and template = 'team-invite'`
  expect(JSON.stringify(row.payload)).not.toContain(invitePath.split('/').pop())

  const anonymous = await pageAs(browser, null)
  await anonymous.goto(invitePath)
  await expect(anonymous.getByRole('heading', { name: 'Join Team 31579 · Exodius' })).toBeVisible()
  await expect(anonymous.getByRole('link', { name: 'Sign in to accept' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(invitePath)}`)

  const wrong = await pageAs(browser, 'coach2')
  await wrong.goto(invitePath)
  await expect(wrong.getByRole('heading', { name: 'This invite is for a different email' })).toBeVisible()
  await expect(wrong.getByRole('button', { name: 'Accept invite' })).toHaveCount(0)
  await expect(wrong.getByRole('button', { name: 'Sign out' })).toBeVisible()

  const invitedRow = coach.locator('#members li', { hasText: invitee })
  await invitedRow.getByRole('button', { name: 'Revoke' }).click()
  await expect(coach.getByText(`The invite to ${invitee} was revoked. Its link no longer works.`)).toBeVisible()
  await anonymous.goto(invitePath)
  await expect(anonymous.getByRole('heading', { name: 'This invite was cancelled' })).toBeVisible()

  expect(problems).toEqual([])
  for (const p of [coach, anonymous, wrong]) await p.context().close()
})

test('accepting an invite joins the team; used, expired and unknown links explain themselves', async ({ browser }) => {
  const person = await pageAs(browser, 'coach-new')
  const problems = watchProblems(person)
  try {
    await person.goto(`/invite/${SEED_INVITE_TOKENS.valid}`)
    await expect(person.getByRole('heading', { name: 'Join Team 31579 · Exodius' })).toBeVisible()
    await person.getByRole('button', { name: 'Accept invite' }).click()
    await person.waitForURL('**/pitches')
    const [member] = await db()`select t.number from team_members m join teams t on t.id = m.team_id
      where m.user_id = (select id from users where email = 'coach-new@pitfund.test')`
    expect(member.number).toBe(31579)

    await person.goto(`/invite/${SEED_INVITE_TOKENS.valid}`)
    await expect(person.getByRole('heading', { name: 'This invite was already used' })).toBeVisible()
    await person.goto(`/invite/${SEED_INVITE_TOKENS.expired}`)
    await expect(person.getByRole('heading', { name: 'This invite has expired' })).toBeVisible()
    await person.goto(`/invite/${SEED_INVITE_TOKENS.revoked}`)
    await expect(person.getByRole('heading', { name: 'This invite was cancelled' })).toBeVisible()
    await person.goto('/invite/not-a-real-token')
    await expect(person.getByRole('heading', { name: 'This invite link isn’t valid' })).toBeVisible()
    expect(problems).toEqual([])
  } finally {
    await db()`delete from team_members where user_id = (select id from users where email = 'coach-new@pitfund.test')`
    await db()`update invites set accepted_at = null where email = 'coach-new@pitfund.test'`
    await person.context().close()
  }
})

test('the only member of a team is told how to leave instead', async ({ browser }) => {
  const coach = await pageAs(browser, 'coach2')
  await coach.goto('/team')
  const members = coach.locator('#members')
  await expect(
    members.getByText(`You own this team and you’re its only member. To leave, invite another coach and make them the owner, or email ${SUPPORT_EMAIL} to delete the team.`),
  ).toBeVisible()
  await expect(members.getByRole('button', { name: 'Leave team' })).toHaveCount(0)
  await coach.context().close()
})
