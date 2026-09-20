import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { getDb } from '@/lib/server/db'
import { invites, pitches, sponsors, teamMembers } from '@/lib/server/schema'
import { DEFAULT_QUESTIONS, questionsFor } from '@/lib/shared/questions'
import { firstApiSeason, pitchSeason, seasonLabel } from '@/lib/shared/season'

import { addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'

describe('seasons', () => {
  it('pitch seasons run Sept 1 → Aug 31', () => {
    expect(pitchSeason(new Date('2026-08-31T23:59:59Z'))).toBe(2025)
    expect(pitchSeason(new Date('2026-09-01T00:00:00Z'))).toBe(2026)
    expect(pitchSeason(new Date('2027-01-15T00:00:00Z'))).toBe(2026)
    expect(seasonLabel(2026)).toBe('2026–27')
    expect(seasonLabel(2099)).toBe('2099–00')
  })

  it('the FIRST API season rolls over in May, separately', () => {
    expect(firstApiSeason(new Date('2026-04-30T00:00:00Z'))).toBe(2025)
    expect(firstApiSeason(new Date('2026-05-01T00:00:00Z'))).toBe(2026)
  })
})

describe('questions', () => {
  it('uses the three defaults with the company name when a company defines none', () => {
    const qs = questionsFor({ name: 'Ribosome', questions: [] })
    expect(qs).toHaveLength(3)
    expect(qs[0].prompt).toBe('Why are you reaching out to Ribosome specifically?')
    expect(qs.map((q) => q.required)).toEqual([true, true, false])
    expect(DEFAULT_QUESTIONS[0].prompt).toContain('{Company}')
  })
})

async function expectViolation(run: () => Promise<unknown>, constraint: string) {
  await getDb().execute(sql`savepoint v`)
  let error: unknown
  try {
    await run()
  } catch (e) {
    error = e
  }
  await getDb().execute(sql`rollback to savepoint v`)
  const cause = (error as { cause?: { constraint_name?: string } })?.cause
  expect(cause?.constraint_name ?? (error as { constraint_name?: string })?.constraint_name).toBe(constraint)
}

describe('database rules', () => {
  it(
    'one pitch per team per company per season; withdrawing frees the slot',
    dbTest(async () => {
      const team = await createTeam()
      const sponsor = await createSponsor()
      const base = { teamId: team.id, sponsorId: sponsor.id, season: 2026 }
      const [first] = await getDb().insert(pitches).values({ ...base, status: 'declined' }).returning()
      await expectViolation(() => getDb().insert(pitches).values({ ...base, status: 'draft' }), 'pitches_one_per_season_key')
      await getDb().update(pitches).set({ status: 'withdrawn' }).where(sql`id = ${first.id}`)
      await getDb().insert(pitches).values({ ...base, status: 'draft' })
      await getDb().insert(pitches).values({ ...base, season: 2027 })
    }),
  )

  it(
    'one team per user, one company per user, ≤10 questions, exactly one org per invite',
    dbTest(async () => {
      const user = await createUser()
      const a = await createTeam()
      const b = await createTeam()
      await addTeamMember(a.id, user.id)
      await expectViolation(() => getDb().insert(teamMembers).values({ teamId: b.id, userId: user.id }), 'team_members_user_key')

      const q = { id: 'q', prompt: 'Why?', required: true }
      await expectViolation(() => getDb().insert(sponsors).values({ name: 'X', website: 'https://x.test', questions: Array(11).fill(q) }), 'sponsors_questions_max')

      await expectViolation(
        () => getDb().insert(invites).values({ kind: 'team', teamId: a.id, sponsorId: null, email: 'x@pitfund.test', tokenHash: crypto.randomUUID(), expiresAt: new Date() }).then(() =>
          getDb().insert(invites).values({ kind: 'sponsor', teamId: a.id, email: 'y@pitfund.test', tokenHash: crypto.randomUUID(), expiresAt: new Date() }),
        ),
        'invites_exactly_one_org',
      )
    }),
  )

  it('row-level security is enabled on every public table, and the API roles hold no grants', async () => {
    const rows = await getDb().execute<{ relname: string; relrowsecurity: boolean }>(sql`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    `)
    expect(rows.length).toBeGreaterThanOrEqual(14)
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([])

    const policies = await getDb().execute(sql`select * from pg_policies where schemaname = 'public'`)
    expect(policies.length).toBe(0)

    const grants = await getDb().execute(sql`
      select grantee, table_name from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
    `)
    expect(grants.length).toBe(0)
  })
})
