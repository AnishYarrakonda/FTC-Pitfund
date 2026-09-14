import type { Viewer, Workspace } from './viewer'

/* Three nav items per audience, maximum (plan §2). */

export type NavItem = { href: string; label: string; match: string[] }

export const NAV: Record<Workspace, NavItem[]> = {
  team: [
    { href: '/pitches', label: 'Pitches', match: ['/pitches'] },
    { href: '/sponsors', label: 'Sponsors', match: ['/sponsors'] },
    { href: '/team', label: 'Team', match: ['/team'] },
  ],
  sponsor: [
    { href: '/inbox', label: 'Pitches', match: ['/inbox'] },
    { href: '/company', label: 'Company', match: ['/company'] },
  ],
  admin: [
    { href: '/admin', label: 'Review', match: ['/admin/pitches', '/admin$'] },
    { href: '/admin/directory', label: 'Directory', match: ['/admin/directory'] },
    { href: '/admin/system', label: 'System', match: ['/admin/system'] },
  ],
}

export function isActive(item: NavItem, pathname: string) {
  return item.match.some((m) => (m.endsWith('$') ? pathname === m.slice(0, -1) : pathname === m || pathname.startsWith(`${m}/`)))
}

/** The workspace shown in the app area (outside /admin). */
export function appWorkspace(viewer: Pick<Viewer, 'team' | 'sponsor'>): Workspace | null {
  if (viewer.team) return 'team'
  if (viewer.sponsor) return 'sponsor'
  return null
}
