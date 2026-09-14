import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { acceptInvite, createInvite, getInviteByToken, listOpenInvites, resendInvite, revokeInvite, type InviteOrg } from '@/lib/server/data/invites'
import { getDb } from '@/lib/server/db'
import { invites, sponsorMembers, teamJoinRequests, teamMembers, teams, users } from '@/lib/server/schema'
import { loadViewer } from '@/lib/server/viewer'

import { addSponsorMember, addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'
import { expectAppError } from './helpers/errors'

const DAY = 24 * 60 * 60 * 1000
const viewerOf = async (userId: string) => (await loadViewer(userId))!

async function teamWithCoach() {
  const team = await createTeam()
  const coach = await createUser()
  await addTeamMember(team.id, coach.id)
  return { team, coach: await viewerOf(coach.id), org: { kind: 'team', id: team.id } as InviteOrg }
}

describe('invite tokens', () => {
  it(
    'store only a hash, work once, and move through valid → used',
    dbTest(async () => {
      const { team, coach, org } = await teamWithCoach()
      const invitee = await createUser({ email: `Invitee-${crypto.randomUUID()}@Pitfund.test` })
      const { invite, token } = await createInvite(coach, org, `  ${invitee.email.toUpperCase()} `)
      expect(invite.email).toBe(invitee.email.toLowerCase())
      expect(invite.tokenHash).not.toContain(token)
      expect(token.length).toBeGreaterThanOrEqual(43)
      expect(invite.expiresAt.getTime() - invite.createdAt.getTime()).toBeGreaterThan(13.9 * DAY)

      expect(await getInviteByToken('not-a-real-token')).toBeNull()
      const details = await getInviteByToken(token)
      expect(details).toMatchObject({ state: 'valid', kind: 'team', org: { id: team.id, number: team.number }, invitedByName: 'Test Person' })

      const result = await acceptInvite(await viewerOf(invitee.id), token, { acceptsTerms: false })
      expect(result).toEqual({ kind: 'team', orgId: team.id, home: '/pitches' })
      expect((await getInviteByToken(token))!.state).toBe('used')
      const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, invitee.id))
      expect(member.teamId).toBe(team.id)
      await expectAppError(acceptInvite(await viewerOf(invitee.id), token, { acceptsTerms: true }), 'CONFLICT', { message: 'This invite was already used.' })
      expect(await listOpenInvites(org)).toEqual([])
    }),
  )

  it(
    'expired, revoked and resent (old link) invites can’t be accepted',
    dbTest(async () => {
      const { coach, org } = await teamWithCoach()
      const invitee = await createUser()
      const viewer = await viewerOf(invitee.id)
      const { invite, token } = await createInvite(coach, org, invitee.email)

      const later = new Date(Date.now() + 15 * DAY)
      expect((await getInviteByToken(token, later))!.state).toBe('expired')
      await expectAppError(acceptInvite(viewer, token, { acceptsTerms: true, now: later }), 'CONFLICT', { message: /expired/ })
      expect((await listOpenInvites(org, later))[0]).toMatchObject({ id: invite.id, expired: true })

      const resent = await resendInvite(coach, org, invite.id)
      expect(resent.token).not.toBe(token)
      expect(await getInviteByToken(token)).toBeNull()
      expect((await getInviteByToken(resent.token))!.state).toBe('valid')

      await revokeInvite(coach, org, invite.id)
      expect((await getInviteByToken(resent.token))!.state).toBe('revoked')
      await expectAppError(acceptInvite(viewer, resent.token, { acceptsTerms: true }), 'CONFLICT', { message: /cancelled/ })
      await expectAppError(revokeInvite(coach, org, invite.id), 'CONFLICT')
      await expectAppError(resendInvite(coach, org, invite.id), 'CONFLICT')
      expect(await getDb().select().from(teamMembers).where(eq(teamMembers.userId, invitee.id))).toEqual([])
    }),
  )

  it(
    'only the invited email, with no other org and accepted terms, can join an active org',
    dbTest(async () => {
      const { team, coach, org } = await teamWithCoach()
      const invitee = await createUser({ acceptedTermsAt: null })
      const { token } = await createInvite(coach, org, invitee.email)

      const wrongPerson = await createUser()
      await expectAppError(acceptInvite(await viewerOf(wrongPerson.id), token, { acceptsTerms: true }), 'FORBIDDEN', { message: new RegExp(`This invite is for ${invitee.email}`) })

      await expectAppError(acceptInvite(await viewerOf(invitee.id), token, { acceptsTerms: false }), 'VALIDATION', { field: 'terms' })

      const pendingElsewhere = await createTeam()
      await getDb().insert(teamJoinRequests).values({ teamId: pendingElsewhere.id, userId: invitee.id })
      await getDb().update(teams).set({ suspendedAt: new Date() }).where(eq(teams.id, team.id))
      await expectAppError(acceptInvite(await viewerOf(invitee.id), token, { acceptsTerms: true }), 'FORBIDDEN')
      await getDb().update(teams).set({ suspendedAt: null }).where(eq(teams.id, team.id))

      await acceptInvite(await viewerOf(invitee.id), token, { acceptsTerms: true })
      const [person] = await getDb().select({ acceptedTermsAt: users.acceptedTermsAt }).from(users).where(eq(users.id, invitee.id))
      expect(person.acceptedTermsAt).not.toBeNull()
      const [request] = await getDb().select().from(teamJoinRequests).where(eq(teamJoinRequests.userId, invitee.id))
      expect(request.status).toBe('cancelled')

      // Someone already on a company can't take a team invite.
      const companyRep = await createUser()
      await addSponsorMember((await createSponsor()).id, companyRep.id)
      const second = await createInvite(coach, org, companyRep.email)
      await expectAppError(acceptInvite(await viewerOf(companyRep.id), second.token, { acceptsTerms: true }), 'CONFLICT', { message: /only one/ })
    }),
  )

  it(
    'inviting an existing member is a conflict on the email field; company invites work the same way',
    dbTest(async () => {
      const { coach, org } = await teamWithCoach()
      await expectAppError(createInvite(coach, org, coach.email), 'CONFLICT', { field: 'email' })

      const company = await createSponsor({ status: 'approved' })
      const rep = await createUser()
      await addSponsorMember(company.id, rep.id)
      const sponsorOrg: InviteOrg = { kind: 'sponsor', id: company.id }
      const colleague = await createUser()
      const { token } = await createInvite(await viewerOf(rep.id), sponsorOrg, colleague.email)
      expect(await getInviteByToken(token)).toMatchObject({ kind: 'sponsor', org: { id: company.id, number: null } })
      await expect(acceptInvite(await viewerOf(colleague.id), token, { acceptsTerms: true })).resolves.toMatchObject({ home: '/inbox' })
      const [member] = await getDb().select().from(sponsorMembers).where(eq(sponsorMembers.userId, colleague.id))
      expect(member.sponsorId).toBe(company.id)

      // A team can't revoke another org's invite.
      const other = await createInvite(await viewerOf(rep.id), sponsorOrg, `someone-${crypto.randomUUID()}@pitfund.test`)
      await expectAppError(revokeInvite(coach, org, other.invite.id), 'CONFLICT')
      const [still] = await getDb().select({ revokedAt: invites.revokedAt }).from(invites).where(eq(invites.id, other.invite.id))
      expect(still.revokedAt).toBeNull()
    }),
  )
})
