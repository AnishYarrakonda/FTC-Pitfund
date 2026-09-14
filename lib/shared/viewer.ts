/*
 * The viewer shape shared by server and client (the app shell receives it as props).
 * Loaded by lib/server/viewer.ts.
 */

export type ViewerTeam = {
  id: string
  number: number
  name: string
  logoPath: string | null
  verifiedAt: Date | null
  suspendedAt: Date | null
}

export type ViewerSponsor = {
  id: string
  name: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  logoPath: string | null
}

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
  unreadCount: number
  pendingJoin: { requestId: string; teamId: string; teamNumber: number; teamName: string } | null
}

export type Workspace = 'team' | 'sponsor' | 'admin'

/** Where a signed-in person lands. */
export function homeFor(viewer: Pick<Viewer, 'team' | 'sponsor' | 'isAdmin' | 'pendingJoin'>): string {
  if (viewer.team) return '/pitches'
  if (viewer.sponsor) return '/inbox'
  if (viewer.pendingJoin) return '/welcome'
  if (viewer.isAdmin) return '/admin'
  return '/welcome'
}

export function displayName(viewer: Pick<Viewer, 'name' | 'email'>) {
  return viewer.name.trim() || viewer.email.split('@')[0]
}
