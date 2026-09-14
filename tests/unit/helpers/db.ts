import { sql } from 'drizzle-orm'

import { getDb, withRollback } from '@/lib/server/db'
import { sponsorMembers, sponsors, teamJoinRequests, teamMembers, teams, users } from '@/lib/server/schema'
import { loadViewer } from '@/lib/server/viewer'

/*
 * Integration-test helpers. Every test body runs inside `withRollback`, so nothing a test
 * writes survives it, and fixtures use random identifiers so parallel files never collide.
 */

export const dbTest = (fn: () => Promise<void>) => () => withRollback(fn)

const rand = () => Math.floor(Math.random() * 900_000) + 100_000

export async function createUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const id = crypto.randomUUID()
  const email = overrides.email ?? `test-${id}@pitfund.test`
  // users.id references auth.users(id); create the auth row inside the same transaction.
  await getDb().execute(sql`insert into auth.users (id, email, aud, role) values (${id}, ${email}, 'authenticated', 'authenticated')`)
  const [row] = await getDb()
    .insert(users)
    .values({ id, email, name: 'Test Person', acceptedTermsAt: new Date(), ...overrides })
    .returning()
  return row
}

export async function createTeam(overrides: Partial<typeof teams.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(teams)
    .values({ number: rand(), name: 'Test Team', city: 'Austin', state: 'TX', country: 'USA', ...overrides })
    .returning()
  return row
}

export async function createSponsor(overrides: Partial<typeof sponsors.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(sponsors)
    .values({ name: `Test Co ${rand()}`, website: 'https://example.com', status: 'approved', ...overrides })
    .returning()
  return row
}

export async function addTeamMember(teamId: string, userId: string) {
  await getDb().insert(teamMembers).values({ teamId, userId })
}

export async function addSponsorMember(sponsorId: string, userId: string) {
  await getDb().insert(sponsorMembers).values({ sponsorId, userId })
}

/**
 * The persona set, built fresh inside the current transaction. Mirrors lib/shared/personas.ts
 * plus the states the authz matrix must cover (suspended user/team, rejected/suspended company).
 */
export async function buildPersonas() {
  const verifiedTeam = await createTeam({ verifiedAt: new Date() })
  const unverifiedTeam = await createTeam()
  const suspendedTeam = await createTeam({ suspendedAt: new Date() })
  const approved = await createSponsor({ status: 'approved' })
  const approved2 = await createSponsor({ status: 'approved' })
  const pending = await createSponsor({ status: 'pending' })
  const rejected = await createSponsor({ status: 'rejected' })
  const suspendedCo = await createSponsor({ status: 'suspended' })

  const admin = await createUser({ isAdmin: true })
  const coachNew = await createUser()
  const coach = await createUser()
  const coachUnverified = await createUser()
  const coachJoiner = await createUser()
  const coachSuspendedTeam = await createUser()
  const sponsorNew = await createUser()
  const sponsorPending = await createUser()
  const sponsor = await createUser()
  const sponsor2 = await createUser()
  const sponsorRejected = await createUser()
  const sponsorSuspended = await createUser()
  const suspendedUser = await createUser({ suspendedAt: new Date() })
  const adminSuspended = await createUser({ isAdmin: true, suspendedAt: new Date() })

  await addTeamMember(verifiedTeam.id, coach.id)
  await addTeamMember(unverifiedTeam.id, coachUnverified.id)
  await addTeamMember(suspendedTeam.id, coachSuspendedTeam.id)
  await getDb().insert(teamJoinRequests).values({ teamId: verifiedTeam.id, userId: coachJoiner.id })
  await addSponsorMember(pending.id, sponsorPending.id)
  await addSponsorMember(approved.id, sponsor.id)
  await addSponsorMember(approved2.id, sponsor2.id)
  await addSponsorMember(rejected.id, sponsorRejected.id)
  await addSponsorMember(suspendedCo.id, sponsorSuspended.id)

  const users = {
    admin,
    'coach-new': coachNew,
    coach,
    'coach-unverified': coachUnverified,
    'coach-joiner': coachJoiner,
    'coach-suspended-team': coachSuspendedTeam,
    'sponsor-new': sponsorNew,
    'sponsor-pending': sponsorPending,
    sponsor,
    sponsor2,
    'sponsor-rejected': sponsorRejected,
    'sponsor-suspended': sponsorSuspended,
    'suspended-user': suspendedUser,
    'admin-suspended': adminSuspended,
  }
  const viewers = Object.fromEntries(
    await Promise.all(Object.entries(users).map(async ([k, u]) => [k, await loadViewer(u.id)] as const)),
  ) as Record<keyof typeof users, NonNullable<Awaited<ReturnType<typeof loadViewer>>>>

  return {
    users,
    viewers,
    teams: { verifiedTeam, unverifiedTeam, suspendedTeam },
    sponsors: { approved, approved2, pending, rejected, suspendedCo },
  }
}
