import type { Metadata } from 'next'

import { PageContainer, PageHeader } from '@/components/ui/page'
import { accountDeletionBlocker, deletionBlockerMessage } from '@/lib/server/data/account'
import { pageViewer } from '@/lib/server/page-guards'

import { AccountForms } from './account-forms'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  const viewer = await pageViewer()
  const blocker = await accountDeletionBlocker(viewer)
  const context = viewer.team ? 'team' : viewer.sponsor ? 'sponsor' : null

  return (
    <PageContainer width="form">
      <PageHeader title="Account" description="Your details, and how you sign in to FTC Pitfund." />
      <AccountForms
        profile={{ name: viewer.name, phone: viewer.phone, jobTitle: viewer.jobTitle }}
        email={viewer.email}
        context={context}
        deletionBlocked={blocker ? deletionBlockerMessage(blocker) : null}
      />
    </PageContainer>
  )
}
