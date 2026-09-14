import type { Metadata } from 'next'

import { PlaceholderPage } from '@/components/app/states'
import { requireAdmin } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'System' }

export default async function AdminSystemPage() {
  await guardPage(() => requireAdmin())
  return (
    <PlaceholderPage
      width="review"
      title="System"
      description="Email delivery, storage, and scheduled jobs."
      emptyTitle="System health opens soon"
      emptyDescription="Emails sent today against the daily limit, queued and failed emails with Retry, storage used and the last daily job run will show here."
    />
  )
}
