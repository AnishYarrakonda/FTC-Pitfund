import type { Metadata } from 'next'

import { PlaceholderPage } from '@/components/app/states'
import { requireAdmin } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'Directory' }

export default async function AdminDirectoryPage() {
  await guardPage(() => requireAdmin())
  return (
    <PlaceholderPage
      width="review"
      title="Directory"
      description="Teams, companies and people on FTC Pitfund."
      emptyTitle="The directory opens soon"
      emptyDescription="You'll search teams, companies and people here, verify teams, approve companies and manage members."
    />
  )
}
