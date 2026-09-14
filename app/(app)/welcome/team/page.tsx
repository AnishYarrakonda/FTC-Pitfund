import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { pageViewer } from '@/lib/server/page-guards'
import { homeFor } from '@/lib/shared/viewer'

import { SetupHandoff } from '../handoff'

export const metadata: Metadata = { title: 'Set up your team' }

export default async function WelcomeTeamPage() {
  const viewer = await pageViewer()
  if (viewer.team || viewer.sponsor) redirect(homeFor(viewer))
  return (
    <SetupHandoff
      title="Set up your team"
      description="Find your team by its FTC number, then create its shared account or ask to join it."
      steps={[
        'Enter your FTC team number. We check it against FIRST records.',
        'Confirm your team, or request to join if another coach already set it up.',
        'Upload your sponsorship deck and a one-line summary, then start pitching.',
      ]}
    />
  )
}
