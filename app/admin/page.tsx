import type { Metadata } from 'next'

import { PlaceholderPage } from '@/components/app/states'
import { requireAdmin } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'Review' }

export default async function AdminReviewPage() {
  await guardPage(() => requireAdmin())
  return (
    <PlaceholderPage
      width="review"
      title="Review"
      description="Pitches waiting for review, new companies, unverified teams and open reports."
      emptyTitle="The review queue opens soon"
      emptyDescription="Every pitch will pass through here before a company sees it. Approve and send, send back with a note, or reject."
    />
  )
}
