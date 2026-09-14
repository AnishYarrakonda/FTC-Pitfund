import type { Metadata } from 'next'

import { PlaceholderPage } from '@/components/app/states'
import { requireSponsorMember } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'Company' }

export default async function CompanyPage() {
  const viewer = await guardPage(() => requireSponsorMember())
  return (
    <PlaceholderPage
      title={viewer.sponsor.name}
      description="Your company profile, the questions teams answer, and your members."
      emptyTitle="Company profile editing opens soon"
      emptyDescription="You'll describe what you look for, write up to 10 questions for teams, and invite coworkers here."
    />
  )
}
