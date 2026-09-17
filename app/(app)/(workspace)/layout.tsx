import { redirect } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'

import { SuspendedNotice } from '@/components/app/states'
import { pageViewer } from '@/lib/server/page-guards'
import { gatePathFor } from '@/lib/shared/viewer'

/* Team and company workspaces: a person with no org goes to /welcome (admins to /admin). */

// This shell redirects (no org, or an org still waiting for review), so it can't be validated as
// instant — same reason as app/(app)/layout.tsx.
export const instant = false

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

  // An org that hasn't been approved has nothing to do in here: it finishes its setup page, or it
  // waits. This is the gate that stops someone claiming a team number and pitching as that team.
  const gate = gatePathFor(viewer)
  if (gate && viewer.team?.status !== 'suspended' && viewer.sponsor?.status !== 'suspended') redirect(gate)

  if (viewer.team?.status === 'suspended') {
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
