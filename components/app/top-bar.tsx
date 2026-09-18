import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/feedback'
import { appWorkspace, NAV } from '@/lib/shared/nav'
import { displayName, homeFor, type Viewer, type Workspace } from '@/lib/shared/viewer'

import { AccountMenu } from './account-menu'
import { MobileNav } from './mobile-nav'
import { NavLinks } from './nav-links'
import { NotificationBell } from './notification-bell'
import { TopBarFrame } from './top-bar-frame'
import { Wordmark } from './wordmark'

const WORKSPACE_LABEL: Record<Workspace, string> = { team: 'team', sponsor: 'company', admin: 'admin' }

function Bar({ children, area }: { children: ReactNode; area: 'app' | 'admin' }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <TopBarFrame area={area}>{children}</TopBarFrame>
    </header>
  )
}

/** The 56 px top bar: wordmark, 2–3 nav items, bell, avatar menu (plan §7). */
export function TopBar({ viewer, area, devTools }: { viewer: Viewer; area: 'app' | 'admin'; devTools: boolean }) {
  const app = appWorkspace(viewer)
  const workspace: Workspace | null = area === 'admin' ? 'admin' : app
  const items = workspace ? NAV[workspace] : []
  const name = displayName(viewer)
  const home = area === 'admin' ? '/admin' : homeFor(viewer)

  const secondary = [
    { href: '/account', label: 'Account' },
    ...(viewer.isAdmin && area !== 'admin' ? [{ href: '/admin', label: 'Switch to admin' }] : []),
    ...(area === 'admin' && app ? [{ href: homeFor(viewer), label: `Switch to ${WORKSPACE_LABEL[app]}` }] : []),
    ...(devTools ? [{ href: '/dev', label: 'Dev tools' }] : []),
  ]

  return (
    <Bar area={area}>
      <div className="flex min-w-0 items-center gap-6">
        <Wordmark href={home} />
        {area === 'admin' ? (
          <span className="hidden rounded-control border border-border px-1.5 py-0.5 text-caption font-medium text-text-secondary sm:inline">Admin</span>
        ) : null}
        <NavLinks items={items} />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {area === 'app' ? <NotificationBell actionCount={viewer.actionCount} /> : null}
        <div className="hidden sm:block">
          <AccountMenu
            name={name}
            email={viewer.email}
            avatarUrl={viewer.avatarUrl}
            isAdmin={viewer.isAdmin}
            workspace={workspace}
            appHome={app ? homeFor(viewer) : null}
            appLabel={app ? WORKSPACE_LABEL[app] : null}
            devTools={devTools}
          />
        </div>
        <MobileNav items={items} secondary={secondary} name={name} email={viewer.email} />
      </div>
    </Bar>
  )
}

export function TopBarSkeleton({ area = 'app' }: { area?: 'app' | 'admin' }) {
  return (
    <Bar area={area}>
      <div className="flex items-center gap-6">
        <Wordmark />
        <div className="hidden items-center gap-3 sm:flex" aria-hidden="true">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3" aria-hidden="true">
        <Skeleton className="size-8 rounded-control" />
        <Skeleton className="size-8 rounded-full" />
      </div>
    </Bar>
  )
}
