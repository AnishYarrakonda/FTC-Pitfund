import type { Metadata } from 'next'

import { PlaceholderPage } from '@/components/app/states'
import { Banner } from '@/components/ui/feedback'
import { PageContainer } from '@/components/ui/page'
import { requireSponsorMember } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

export const metadata: Metadata = { title: 'Pitches' }

export default async function InboxPage() {
  const viewer = await guardPage(() => requireSponsorMember())
  const { sponsor } = viewer
  return (
    <>
      {sponsor.status === 'pending' ? (
        <PageContainer className="pb-0 sm:pb-0">
          <Banner tone="warning" title={`${sponsor.name} is waiting for approval`}>
            An FTC Pitfund admin reviews every new company, usually within a day. Teams can pitch you once you&apos;re approved. Set up your profile in the meantime.
          </Banner>
        </PageContainer>
      ) : null}
      {sponsor.status === 'rejected' ? (
        <PageContainer className="pb-0 sm:pb-0">
          <Banner tone="danger" title={`${sponsor.name} wasn't approved`}>
            Teams can&apos;t see or pitch your company. Questions? Email {SUPPORT_EMAIL}.
          </Banner>
        </PageContainer>
      ) : null}
      <PlaceholderPage
        title="Pitches"
        description={`Pitches from FTC teams to ${sponsor.name}, already screened by a reviewer.`}
        emptyTitle="New pitches will appear here"
        emptyDescription="Each pitch answers your questions and includes the team's deck. Say you're interested and you'll both get each other's contact details."
      />
    </>
  )
}
