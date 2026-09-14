import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PageContainer } from '@/components/ui/page'
import { pageViewer } from '@/lib/server/page-guards'
import { homeFor } from '@/lib/shared/viewer'

import { JoinRequestWaiting } from './join-request-waiting'
import { WelcomeForm } from './welcome-form'

export const metadata: Metadata = { title: 'Welcome' }

export default async function WelcomePage() {
  const viewer = await pageViewer()
  if (viewer.team || viewer.sponsor) redirect(homeFor(viewer))

  return (
    <PageContainer width="form" className="sm:pt-16">
      {viewer.pendingJoin ? (
        <JoinRequestWaiting request={viewer.pendingJoin} />
      ) : (
        <WelcomeForm defaultName={viewer.name} email={viewer.email} />
      )}
    </PageContainer>
  )
}
