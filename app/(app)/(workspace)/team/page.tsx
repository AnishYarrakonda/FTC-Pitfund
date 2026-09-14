import type { Metadata } from 'next'

import { PlaceholderPage } from '@/components/app/states'
import { requireTeamMember } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'Team' }

export default async function TeamPage() {
  const viewer = await guardPage(() => requireTeamMember())
  return (
    <PlaceholderPage
      title={`Team ${viewer.team.number} · ${viewer.team.name}`}
      description="Your public profile, sponsorship deck and members."
      emptyTitle="Team profile editing opens soon"
      emptyDescription="You'll upload your deck, write a one-line summary and invite other coaches here."
    />
  )
}
