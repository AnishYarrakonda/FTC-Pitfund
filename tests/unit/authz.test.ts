import { describe, expect, it } from 'vitest'

import {
  requireAdmin,
  requireApprovedSponsor,
  requireNoOrg,
  requireSponsorMember,
  requireTeamMember,
  requireViewer,
} from '@/lib/server/authz'
import { AppError } from '@/lib/server/result'
import { homeFor } from '@/lib/shared/viewer'
import { loadViewer } from '@/lib/server/viewer'

import { buildPersonas, dbTest } from './helpers/db'

/*
 * The authz matrix (plan §10): every guard × every persona. A cell is either 'ok' or the
 * error code the guard must throw. Includes the states personas can drift into: a pending
 * company member, a suspended team member, a user with no org, suspended people and companies.
 */

type Outcome = 'ok' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'

type Guard = 'viewer' | 'admin' | 'teamMember' | 'sponsorMember' | 'approvedSponsor' | 'noOrg'

const MATRIX: Record<string, Record<Guard, Outcome>> = {
  anonymous: { viewer: 'UNAUTHORIZED', admin: 'UNAUTHORIZED', teamMember: 'UNAUTHORIZED', sponsorMember: 'UNAUTHORIZED', approvedSponsor: 'UNAUTHORIZED', noOrg: 'UNAUTHORIZED' },
  admin: { viewer: 'ok', admin: 'ok', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'ok' },
  'admin-suspended': { viewer: 'FORBIDDEN', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'FORBIDDEN' },
  'coach-new': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'ok' },
  coach: { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'ok', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'CONFLICT' },
  'coach-unverified': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'ok', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'CONFLICT' },
  'coach-joiner': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'ok' },
  'coach-suspended-team': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'CONFLICT' },
  'sponsor-new': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'ok' },
  'sponsor-pending': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'ok', approvedSponsor: 'FORBIDDEN', noOrg: 'CONFLICT' },
  sponsor: { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'ok', approvedSponsor: 'ok', noOrg: 'CONFLICT' },
  sponsor2: { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'ok', approvedSponsor: 'ok', noOrg: 'CONFLICT' },
  'sponsor-rejected': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'ok', approvedSponsor: 'FORBIDDEN', noOrg: 'CONFLICT' },
  'sponsor-suspended': { viewer: 'ok', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'CONFLICT' },
  'suspended-user': { viewer: 'FORBIDDEN', admin: 'FORBIDDEN', teamMember: 'FORBIDDEN', sponsorMember: 'FORBIDDEN', approvedSponsor: 'FORBIDDEN', noOrg: 'FORBIDDEN' },
}

async function outcome(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    await run()
    return 'ok'
  } catch (e) {
    if (e instanceof AppError) return e.code as Outcome
    throw e
  }
}

describe('authz matrix', () => {
  it(
    'every guard × every persona',
    dbTest(async () => {
      const { viewers } = await buildPersonas()
      const actual: typeof MATRIX = {}
      for (const persona of Object.keys(MATRIX)) {
        const viewer = persona === 'anonymous' ? null : viewers[persona as keyof typeof viewers]
        actual[persona] = {
          viewer: await outcome(() => requireViewer({ viewer })),
          admin: await outcome(() => requireAdmin({ viewer })),
          teamMember: await outcome(() => requireTeamMember({ viewer })),
          sponsorMember: await outcome(() => requireSponsorMember({ viewer })),
          approvedSponsor: await outcome(() => requireApprovedSponsor({ viewer })),
          noOrg: await outcome(() => requireNoOrg({ viewer })),
        }
      }
      expect(actual).toEqual(MATRIX)
    }),
  )

  it(
    "membership checks never reveal another org's existence",
    dbTest(async () => {
      const { viewers, teams, sponsors } = await buildPersonas()
      // A coach asking for another team's id, and a sponsor for another company's, get NOT_FOUND.
      expect(await outcome(() => requireTeamMember({ viewer: viewers.coach, teamId: teams.unverifiedTeam.id }))).toBe('NOT_FOUND')
      expect(await outcome(() => requireTeamMember({ viewer: viewers.coach, teamId: teams.verifiedTeam.id }))).toBe('ok')
      expect(await outcome(() => requireSponsorMember({ viewer: viewers.sponsor2, sponsorId: sponsors.approved.id }))).toBe('NOT_FOUND')
      expect(await outcome(() => requireApprovedSponsor({ viewer: viewers.sponsor, sponsorId: sponsors.approved.id }))).toBe('ok')
      // Someone with no team asking for a specific team id also gets NOT_FOUND, not FORBIDDEN.
      expect(await outcome(() => requireTeamMember({ viewer: viewers['coach-new'], teamId: teams.verifiedTeam.id }))).toBe('NOT_FOUND')
    }),
  )

  it(
    'the viewer query loads membership, join request and unread count in one row',
    dbTest(async () => {
      const { viewers, teams, sponsors, users } = await buildPersonas()
      expect(viewers.coach.team?.id).toBe(teams.verifiedTeam.id)
      expect(viewers.coach.sponsor).toBeNull()
      expect(viewers.sponsor.sponsor).toMatchObject({ id: sponsors.approved.id, status: 'approved' })
      expect(viewers['coach-joiner'].pendingJoin).toMatchObject({ teamId: teams.verifiedTeam.id, teamNumber: teams.verifiedTeam.number })
      expect(viewers['coach-new']).toMatchObject({ team: null, sponsor: null, pendingJoin: null, unreadCount: 0 })
      expect(await loadViewer(crypto.randomUUID())).toBeNull()

      expect(homeFor(viewers.coach)).toBe('/pitches')
      expect(homeFor(viewers.sponsor)).toBe('/inbox')
      expect(homeFor(viewers['coach-joiner'])).toBe('/welcome')
      expect(homeFor(viewers.admin)).toBe('/admin')
      expect(homeFor(viewers['coach-new'])).toBe('/welcome')
      expect(users.admin.isAdmin).toBe(true)
    }),
  )
})
