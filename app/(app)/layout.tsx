import { Suspense, type ReactNode } from 'react'

import { SuspendedNotice } from '@/components/app/states'
import { TopBar, TopBarSkeleton } from '@/components/app/top-bar'
import { devToolsEnabled } from '@/lib/server/env'
import { pageViewer } from '@/lib/server/page-guards'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

/*
 * The signed-in app shell. Requires a viewer; the workspace gate (org required) lives in the
 * (workspace) group so /welcome and /account work before someone has a team or company.
 */
// Signed-out visitors are redirected to /login from inside the shell, so this segment is
// allowed to block; pages beneath it still stream behind their loading.tsx skeletons.
export const instant = false

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <>
          <TopBarSkeleton />
          <main id="main" className="min-w-0" />
        </>
      }
    >
      <AppFrame>{children}</AppFrame>
    </Suspense>
  )
}

async function AppFrame({ children }: { children: ReactNode }) {
  const viewer = await pageViewer()
  return (
    <>
      <TopBar viewer={viewer} area="app" devTools={devToolsEnabled()} />
      <main id="main" className="min-w-0">
        {viewer.suspendedAt ? (
          <SuspendedNotice title="Your account is suspended">
            You can&apos;t use FTC Pitfund while your account is suspended. If you think this is a mistake, email {SUPPORT_EMAIL}.
          </SuspendedNotice>
        ) : (
          children
        )}
      </main>
    </>
  )
}
