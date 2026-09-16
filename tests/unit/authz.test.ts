import { describe, expect, it } from 'vitest'

import {
  requireAdmin,
  requireApprovedSponsor,
  requireApprovedTeam,
  requireNoOrg,
  requireSponsorMember,
  requireSponsorOwner,
  requireSponsorSetup,
  requireTeamMember,
  requireTeamOwner,
  requireTeamSetup,
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

type Guard =
  | 'viewer'
  | 'admin'
  | 'teamMember'
  | 'approvedTeam'
  | 'teamSetup'
  | 'teamOwner'
  | 'sponsorMember'
  | 'approvedSponsor'
  | 'sponsorSetup'
  | 'sponsorOwner'
  | 'noOrg'

/**
 * Every guard against every persona. The three that matter most:
 *   - an org that hasn't been approved yet reaches its setup page and nothing else, so nobody can
 *     claim a team number and start pitching as that team;
 *   - an editor can do everything except change who is on the account;
 *   - a rejected org can edit again (to fix what was wrong) but still can't use the app.
 */
const MATRIX: Record<string, Record<Guard, Outcome>> = {
  anonymous: row('UNAUTHORIZED'),
  admin: { ...row('FORBIDDEN'), viewer: 'ok', admin: 'ok', noOrg: 'ok' },
  'admin-suspended': row('FORBIDDEN'),
  'coach-new': { ...row('FORBIDDEN'), viewer: 'ok', noOrg: 'ok' },
  coach: { ...row('FORBIDDEN'), viewer: 'ok', teamMember: 'ok', approvedTeam: 'ok', teamSetup: 'ok', teamOwner: 'ok', noOrg: 'CONFLICT' },
  'coach-editor': { ...row('FORBIDDEN'), viewer: 'ok', teamMember: 'ok', approvedTeam: 'ok', teamSetup: 'ok', noOrg: 'CONFLICT' },
  'coach-draft': { ...row('FORBIDDEN'), viewer: 'ok', teamMember: 'ok', teamSetup: 'ok', noOrg: 'CONFLICT' },
  'coach-pending': { ...row('FORBIDDEN'), viewer: 'ok', teamMember: 'ok', noOrg: 'CONFLICT' },
  'coach-joiner': { ...row('FORBIDDEN'), viewer: 'ok', noOrg: 'ok' },
  'coach-suspended-team': { ...row('FORBIDDEN'), viewer: 'ok', noOrg: 'CONFLICT' },
  'sponsor-new': { ...row('FORBIDDEN'), viewer: 'ok', noOrg: 'ok' },
  'sponsor-pending': { ...row('FORBIDDEN'), viewer: 'ok', sponsorMember: 'ok', noOrg: 'CONFLICT' },
  sponsor: {
    ...row('FORBIDDEN'),
    viewer: 'ok',
    sponsorMember: 'ok',
    approvedSponsor: 'ok',
    sponsorSetup: 'ok',
    sponsorOwner: 'ok',
    noOrg: 'CONFLICT',
  },
  sponsor2: {
    ...row('FORBIDDEN'),
    viewer: 'ok',
    sponsorMember: 'ok',
    approvedSponsor: 'ok',
    sponsorSetup: 'ok',
    sponsorOwner: 'ok',
    noOrg: 'CONFLICT',
  },
  'sponsor-rejected': { ...row('FORBIDDEN'), viewer: 'ok', sponsorMember: 'ok', sponsorSetup: 'ok', noOrg: 'CONFLICT' },
  'sponsor-suspended': { ...row('FORBIDDEN'), viewer: 'ok', noOrg: 'CONFLICT' },
  'suspended-user': row('FORBIDDEN'),
}

function row(outcome: Outcome): Record<Guard, Outcome> {
  return {
    viewer: outcome,
    admin: outcome,
    teamMember: outcome,
    approvedTeam: outcome,
    teamSetup: outcome,
    teamOwner: outcome,
    sponsorMember: outcome,
    approvedSponsor: outcome,
    sponsorSetup: outcome,
    sponsorOwner: outcome,
    noOrg: outcome,
  }
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
          approvedTeam: await outcome(() => requireApprovedTeam({ viewer })),
          teamSetup: await outcome(() => requireTeamSetup({ viewer })),
          teamOwner: await outcome(() => requireTeamOwner({ viewer })),
          sponsorMember: await outcome(() => requireSponsorMember({ viewer })),
          approvedSponsor: await outcome(() => requireApprovedSponsor({ viewer })),
          sponsorSetup: await outcome(() => requireSponsorSetup({ viewer })),
          sponsorOwner: await outcome(() => requireSponsorOwner({ viewer })),
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
      expect(await outcome(() => requireTeamMember({ viewer: viewers.coach, teamId: teams.draftTeam.id }))).toBe('NOT_FOUND')
      expect(await outcome(() => requireTeamMember({ viewer: viewers.coach, teamId: teams.approvedTeam.id }))).toBe('ok')
      expect(await outcome(() => requireSponsorMember({ viewer: viewers.sponsor2, sponsorId: sponsors.approved.id }))).toBe('NOT_FOUND')
      expect(await outcome(() => requireApprovedSponsor({ viewer: viewers.sponsor, sponsorId: sponsors.approved.id }))).toBe('ok')
      // Someone with no team asking for a specific team id also gets NOT_FOUND, not FORBIDDEN.
      expect(await outcome(() => requireTeamMember({ viewer: viewers['coach-new'], teamId: teams.approvedTeam.id }))).toBe('NOT_FOUND')
    }),
  )

  it(
    'the viewer query loads membership, join request and unread count in one row',
    dbTest(async () => {
      const { viewers, teams, sponsors, users } = await buildPersonas()
      expect(viewers.coach.team?.id).toBe(teams.approvedTeam.id)
      expect(viewers.coach.sponsor).toBeNull()
      expect(viewers.sponsor.sponsor).toMatchObject({ id: sponsors.approved.id, status: 'approved' })
      expect(viewers['coach-joiner'].pendingJoin).toMatchObject({ teamId: teams.approvedTeam.id, teamNumber: teams.approvedTeam.number })
      expect(viewers['coach-new']).toMatchObject({ team: null, sponsor: null, pendingJoin: null, actionCount: 0 })
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
