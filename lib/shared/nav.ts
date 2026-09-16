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

/**
 * The workspace shown in the app area (outside /admin).
 *
 * An org that hasn't been approved has no workspace: every one of those links would only bounce it
 * back to /welcome, so the top bar shows the wordmark and the account menu and nothing else.
 */
export function appWorkspace(viewer: Pick<Viewer, 'team' | 'sponsor'>): Workspace | null {
  if (viewer.team) return viewer.team.status === 'approved' ? 'team' : null
  if (viewer.sponsor) return viewer.sponsor.status === 'approved' ? 'sponsor' : null
  return null
}

/**
 * App pages laid out at the 1280 px review width (the composer and a pitch's page, which have a
 * side column). The top bar widens with them so the wordmark lines up with the page content.
 */
const WIDE_APP_PAGES = [/^\/sponsors\/[^/]+\/pitch$/, /^\/pitches\/[^/]+$/]

export function isWideAppPage(pathname: string) {
  return WIDE_APP_PAGES.some((re) => re.test(pathname))
}
