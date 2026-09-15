import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'

import { SuspendedNotice } from '@/components/app/states'
import { pageViewer } from '@/lib/server/page-guards'

/* Team and company workspaces: a person with no org goes to /welcome (admins to /admin). */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <WorkspaceGate>{children}</WorkspaceGate>
    </Suspense>
  )
}

async function WorkspaceGate({ children }: { children: ReactNode }) {
  const viewer = await pageViewer()
  if (!viewer.team && !viewer.sponsor) redirect(viewer.isAdmin && !viewer.pendingJoin ? '/admin' : '/welcome')

  if (viewer.team?.suspendedAt) {
    return (
      <SuspendedNotice title={`Team ${viewer.team.number} is suspended`}>
        Your team can&apos;t pitch or edit its profile while it&apos;s suspended, and its public page is hidden.
      </SuspendedNotice>
    )
  }
  if (viewer.sponsor?.status === 'suspended') {
    return (
      <SuspendedNotice title={`${viewer.sponsor.name} is suspended`}>
        Teams can&apos;t see or pitch your company while it&apos;s suspended.
      </SuspendedNotice>
    )
  }
  return children
}
