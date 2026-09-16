import 'server-only'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import type { OrgStatus } from '@/lib/shared/types'
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
  if (team.status === 'suspended') {
    throw new AppError('FORBIDDEN', `Team ${team.number} is suspended. Contact ${SUPPORT_EMAIL}.`)
  }
  return viewer as TeamViewer
}

/**
 * The gate every org passes before it reaches the app. Both kinds use the same words because they go
 * through the same review — a coach and a company employee see the same wait.
 */
function assertApproved(org: { name: string; status: OrgStatus }, label: string): void {
  if (org.status === 'approved') return
  if (org.status === 'draft') {
    throw new AppError('FORBIDDEN', `Finish setting up ${label} and send it for review first.`)
  }
  if (org.status === 'pending') {
    throw new AppError('FORBIDDEN', `${label} is waiting to be reviewed. You can do this once it's approved.`)
  }
  if (org.status === 'rejected') {
    throw new AppError('FORBIDDEN', `${label} wasn't approved on FTC Pitfund. Contact ${SUPPORT_EMAIL}.`)
  }
  throw new AppError('FORBIDDEN', `${label} is suspended. Contact ${SUPPORT_EMAIL}.`)
}

/** Editing the setup page: allowed before submitting, and again after a rejection so it can be fixed. */
function assertEditableSetup(org: { name: string; status: OrgStatus }, label: string): void {
  if (org.status === 'draft' || org.status === 'rejected') return
  if (org.status === 'pending') {
    throw new AppError('FORBIDDEN', `${label} is being reviewed. You can change this again if we ask for changes.`)
  }
  if (org.status === 'approved') return
  throw new AppError('FORBIDDEN', `${label} is suspended. Contact ${SUPPORT_EMAIL}.`)
}

const teamLabelOf = (team: ViewerTeam) => `Team ${team.number}`

/** A team that has been approved: everything in the workspace requires this. */
export async function requireApprovedTeam(options: GuardOptions & { teamId?: string } = {}): Promise<TeamViewer> {
  const viewer = await requireTeamMember(options)
  assertApproved(viewer.team, teamLabelOf(viewer.team))
  return viewer
}

/** A team that is still filling in its setup page, or fixing it after a rejection. */
export async function requireTeamSetup(options: GuardOptions = {}): Promise<TeamViewer> {
  const viewer = await requireTeamMember(options)
  assertEditableSetup(viewer.team, teamLabelOf(viewer.team))
  return viewer
}

/**
 * The one member who owns the account. Only they change who is on it, so a coach who joins later
 * can't remove the coach who created the team.
 */
export async function requireTeamOwner(options: GuardOptions = {}): Promise<TeamViewer> {
  const viewer = await requireApprovedTeam(options)
  if (viewer.team.role !== 'owner') {
    throw new AppError('FORBIDDEN', 'Only the team owner can do that.')
  }
  return viewer
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

export async function requireApprovedSponsor(options: GuardOptions & { sponsorId?: string } = {}): Promise<SponsorViewer> {
  const viewer = await requireSponsorMember(options)
  assertApproved(viewer.sponsor, viewer.sponsor.name)
  return viewer
}

/** A company still filling in its profile and questions, or fixing them after a rejection. */
export async function requireSponsorSetup(options: GuardOptions = {}): Promise<SponsorViewer> {
  const viewer = await requireSponsorMember(options)
  assertEditableSetup(viewer.sponsor, viewer.sponsor.name)
  return viewer
}

export async function requireSponsorOwner(options: GuardOptions = {}): Promise<SponsorViewer> {
  const viewer = await requireApprovedSponsor(options)
  if (viewer.sponsor.role !== 'owner') {
    throw new AppError('FORBIDDEN', 'Only the company owner can do that.')
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
