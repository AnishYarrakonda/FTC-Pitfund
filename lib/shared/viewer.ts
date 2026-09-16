/*
 * The viewer shape shared by server and client (the app shell receives it as props).
 * Loaded by lib/server/viewer.ts.
 */

import type { OrgRole, OrgStatus } from './types'

/** What a team and a company have in common: both are one shared account behind the same gate. */
type ViewerOrg = {
  id: string
  name: string
  /** Only an `approved` org reaches the workspace; everything else is held at /welcome. */
  status: OrgStatus
  /** This viewer's role in it. Only an owner changes who is on the account. */
  role: OrgRole
  /** Why an admin rejected it, shown back on /welcome/pending. Null unless rejected. */
  note: string | null
  logoPath: string | null
}

export type ViewerTeam = ViewerOrg & { number: number }

export type ViewerSponsor = ViewerOrg

export type Viewer = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  phone: string | null
  jobTitle: string | null
  isAdmin: boolean
  acceptedTermsAt: Date | null
  suspendedAt: Date | null
  team: ViewerTeam | null
  sponsor: ViewerSponsor | null
  /** Open items needing this person's attention — what the bell counts. Not a log of everything. */
  actionCount: number
  pendingJoin: { requestId: string; teamId: string; teamNumber: number; teamName: string } | null
}

export type Workspace = 'team' | 'sponsor' | 'admin'

export type ViewerOrgs = Pick<Viewer, 'team' | 'sponsor' | 'isAdmin' | 'pendingJoin'>

/** The org this person belongs to, whichever kind it is, or null. */
export function viewerOrg(viewer: Pick<Viewer, 'team' | 'sponsor'>): ViewerOrg | null {
  return viewer.team ?? viewer.sponsor ?? null
}

export function isOwner(viewer: Pick<Viewer, 'team' | 'sponsor'>): boolean {
  return viewerOrg(viewer)?.role === 'owner'
}

/**
 * Where an org that hasn't been approved yet has to go. `draft` means they never finished the setup
 * page; anything else means they are waiting on, or were refused by, an admin.
 */
export function gatePathFor(viewer: Pick<Viewer, 'team' | 'sponsor'>): string | null {
  const org = viewerOrg(viewer)
  if (!org || org.status === 'approved') return null
  if (org.status === 'draft') return viewer.team ? '/welcome/team' : '/welcome/company'
  return '/welcome/pending'
}

/** Where a signed-in person lands. */
export function homeFor(viewer: ViewerOrgs): string {
  const gate = gatePathFor(viewer)
  if (gate) return gate
  if (viewer.team) return '/pitches'
  if (viewer.sponsor) return '/inbox'
  if (viewer.pendingJoin) return '/welcome'
  if (viewer.isAdmin) return '/admin'
  return '/welcome'
}

/**
 * Where sign-in lands. First-timers go to /welcome, except when they came from an invite link:
 * accepting the invite is their first run.
 */
export function signInDestination(viewer: ViewerOrgs | null, next: string | null, intent: 'team' | 'company' | null = null): string {
  if (next?.startsWith('/invite/')) return next
  if (!viewer || (!viewer.team && !viewer.sponsor && !viewer.isAdmin)) return welcomePath(intent)
  // An org still behind the gate ignores ?next — there is nothing in the app for it to return to.
  return gatePathFor(viewer) ?? next ?? homeFor(viewer)
}

/** /welcome, preselecting the branch the visitor chose on the landing page. */
export function welcomePath(intent: 'team' | 'company' | null) {
  return intent ? `/welcome?intent=${intent}` : '/welcome'
}

export function displayName(viewer: Pick<Viewer, 'name' | 'email'>) {
  return viewer.name.trim() || viewer.email.split('@')[0]
}
