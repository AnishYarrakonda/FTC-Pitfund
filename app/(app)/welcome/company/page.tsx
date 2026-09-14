import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { pageViewer } from '@/lib/server/page-guards'
import { homeFor } from '@/lib/shared/viewer'

import { SetupHandoff } from '../handoff'

export const metadata: Metadata = { title: 'Set up your company' }

export default async function WelcomeCompanyPage() {
  const viewer = await pageViewer()
  if (viewer.team || viewer.sponsor) redirect(homeFor(viewer))
  return (
    <SetupHandoff
      title="Set up your company"
      description="Create your company's shared account. An FTC Pitfund admin approves it before teams can see it."
      steps={[
        'Add your company name, website and your job title.',
        'Say what kind of support you offer and write up to 10 questions for teams.',
        'Once you’re approved, screened pitches arrive in your inbox.',
      ]}
    />
  )
}
