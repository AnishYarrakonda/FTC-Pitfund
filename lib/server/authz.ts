import 'server-only'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import type { Viewer, ViewerSponsor, ViewerTeam } from '@/lib/shared/viewer'

import { AppError } from './result'
import { getViewer } from './viewer'

/*
 * The permission layer. Every data function receives the viewer these guards return.
 * Guards throw AppError (UNAUTHORIZED / FORBIDDEN / NOT_FOUND); `defineAction` turns that
 * into a Result, and pages turn it into redirect()/notFound().
 *
 * `viewer` defaults to the request's signed-in viewer. Tests pass one explicitly.
 * Membership mismatches are NOT_FOUND, never FORBIDDEN, so ids don't leak existence.
 */

type GuardOptions = { viewer?: Viewer | null }

export type TeamViewer = Viewer & { team: ViewerTeam }
export type SponsorViewer = Viewer & { sponsor: ViewerSponsor }

async function resolve(options: GuardOptions): Promise<Viewer | null> {
  return options.viewer === undefined ? getViewer() : options.viewer
}

export async function requireViewer(options: GuardOptions = {}): Promise<Viewer> {
  const viewer = await resolve(options)
  if (!viewer) throw new AppError('UNAUTHORIZED', 'Sign in to continue.')
  if (viewer.suspendedAt) {
    throw new AppError('FORBIDDEN', `Your account is suspended. Contact ${SUPPORT_EMAIL} if you think this is a mistake.`)
  }
  return viewer
}

export async function requireAdmin(options: GuardOptions = {}): Promise<Viewer> {
  const viewer = await requireViewer(options)
  if (!viewer.isAdmin) throw new AppError('FORBIDDEN', 'Only FTC Pitfund admins can do that.')
  return viewer
}

export async function requireTeamMember(options: GuardOptions & { teamId?: string } = {}): Promise<TeamViewer> {
  const viewer = await requireViewer(options)
  const team = viewer.team
  if (!team) {
    if (options.teamId) throw new AppError('NOT_FOUND', "That team doesn't exist or you're not on it.")
    throw new AppError('FORBIDDEN', 'Join or create a team first.')
  }
  if (options.teamId && options.teamId !== team.id) {
    throw new AppError('NOT_FOUND', "That team doesn't exist or you're not on it.")
  }
  if (team.suspendedAt) {
    throw new AppError('FORBIDDEN', `Team ${team.number} is suspended. Contact ${SUPPORT_EMAIL}.`)
  }
  return viewer as TeamViewer
}

export async function requireSponsorMember(
  options: GuardOptions & { sponsorId?: string } = {},
): Promise<SponsorViewer> {
  const viewer = await requireViewer(options)
  const sponsor = viewer.sponsor
  if (!sponsor) {
    if (options.sponsorId) throw new AppError('NOT_FOUND', "That company doesn't exist or you're not part of it.")
    throw new AppError('FORBIDDEN', 'Set up your company first.')
  }
  if (options.sponsorId && options.sponsorId !== sponsor.id) {
    throw new AppError('NOT_FOUND', "That company doesn't exist or you're not part of it.")
  }
  if (sponsor.status === 'suspended') {
    throw new AppError('FORBIDDEN', `${sponsor.name} is suspended. Contact ${SUPPORT_EMAIL}.`)
  }
  return viewer as SponsorViewer
}

export async function requireApprovedSponsor(
  options: GuardOptions & { sponsorId?: string } = {},
): Promise<SponsorViewer> {
  const viewer = await requireSponsorMember(options)
  if (viewer.sponsor.status === 'pending') {
    throw new AppError('FORBIDDEN', `${viewer.sponsor.name} is waiting for approval. You can do this once it's approved.`)
  }
  if (viewer.sponsor.status !== 'approved') {
    throw new AppError('FORBIDDEN', `${viewer.sponsor.name} isn't approved on FTC Pitfund. Contact ${SUPPORT_EMAIL}.`)
  }
  return viewer
}

/** A person with no team, no company and no pending join request (the /welcome state). */
export async function requireNoOrg(options: GuardOptions = {}): Promise<Viewer> {
  const viewer = await requireViewer(options)
  if (viewer.team || viewer.sponsor) {
    throw new AppError('CONFLICT', "You're already part of a team or company.")
  }
  return viewer
}
