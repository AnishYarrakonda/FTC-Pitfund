import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageContainer } from '@/components/ui/page'
import { pageViewer } from '@/lib/server/page-guards'
import { homeFor } from '@/lib/shared/viewer'

import { CompanySetup } from './company-setup'

export const metadata: Metadata = { title: 'Set up your company' }

export default async function WelcomeCompanyPage() {
  const viewer = await pageViewer()
  if (viewer.team || viewer.sponsor || viewer.pendingJoin) redirect(homeFor(viewer))
  return (
    <PageContainer width="form" className="sm:pt-16">
      <Link href="/welcome" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>
      <header className="mt-6 grid gap-2">
        <h1 className="text-h1 font-semibold tracking-tighter text-text">Set up your company</h1>
        <p className="text-lead text-text-secondary">
          Your company gets one shared account for everyone who reads pitches. An FTC Pitfund admin approves it before teams can see it.
        </p>
      </header>
      <CompanySetup defaultName={viewer.name} defaultJobTitle={viewer.jobTitle ?? ''} />
    </PageContainer>
  )
}
