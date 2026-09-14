import { Suspense, type ReactNode } from 'react'

import { TopBar, TopBarSkeleton } from '@/components/app/top-bar'
import { requireAdmin } from '@/lib/server/authz'
import { devToolsEnabled } from '@/lib/server/env'
import { guardPage } from '@/lib/server/page-guards'

/* Admin area: Review · Directory · System. Requires users.is_admin. */
// Non-admins are redirected from inside the shell, so this segment is allowed to block.
export const instant = false

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <>
          <TopBarSkeleton area="admin" />
          <main id="main" className="min-w-0" />
        </>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  )
}

async function AdminFrame({ children }: { children: ReactNode }) {
  const viewer = await guardPage(() => requireAdmin())
  return (
    <>
      <TopBar viewer={viewer} area="admin" devTools={devToolsEnabled()} />
      <main id="main" className="min-w-0">
        {children}
      </main>
    </>
  )
}
