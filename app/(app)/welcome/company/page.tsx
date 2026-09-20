import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CompanyEditor } from '@/components/company/company-editor'
import { Banner } from '@/components/ui/banner'
import { PageContainer } from '@/components/ui/page'
import { requireSponsorMember } from '@/lib/server/authz'
import { getCompanyProfile } from '@/lib/server/data/company'
import { pageViewer } from '@/lib/server/page-guards'
import { companyChecklist } from '@/lib/shared/company'
import { homeFor, welcomePath } from '@/lib/shared/viewer'

import { CompanySetup } from './company-setup'
import { SubmitBar } from './submit-bar'

export const metadata: Metadata = { title: 'Set up your company' }

/**
 * Company first run: create the account, fill in the profile and the questions teams answer, then
 * send it for review. Same gate as a team — nothing is visible to coaches until an admin approves.
 */
export default async function WelcomeCompanyPage() {
  const viewer = await pageViewer()
  if (viewer.team || viewer.pendingJoin) redirect(homeFor(viewer))
  // /welcome is where the 18+ and Terms confirmation is collected; nobody sets up an org around it.
  if (!viewer.acceptedTermsAt) redirect(welcomePath('company'))
  if (!viewer.sponsor) {
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
  if (viewer.sponsor.status === 'approved' || viewer.sponsor.status === 'suspended') redirect(homeFor(viewer))

  const sponsorViewer = await requireSponsorMember({ viewer })
  const profile = await getCompanyProfile(sponsorViewer)
  const checklist = companyChecklist({
    hasLogo: Boolean(profile.logoUrl),
    hasAbout: Boolean(profile.about?.trim()),
    supportTypeCount: profile.supportTypes.length,
    questionCount: profile.usesDefaultQuestions ? 0 : profile.questions.length,
    reviewedQuestions: profile.reviewedQuestions,
  })
  const blockers = checklist.items.filter((i) => !i.done).map((i) => i.label)
  const waiting = profile.status === 'pending'

  return (
    <PageContainer width="app" className="sm:pt-16">
      <header className="grid gap-2">
        <h1 className="text-h1 font-semibold tracking-tighter text-text user-text">
          {waiting ? `${profile.name}, waiting for review` : `Tell us about ${profile.name}`}
        </h1>
        <p className="text-lead text-text-secondary">
          {waiting
            ? 'You can still change any of this while you wait — it goes back into the same queue.'
            : 'This is what an FTC Pitfund admin checks, and what teams see once you’re approved.'}
        </p>
      </header>

      {profile.status === 'rejected' && profile.statusNote ? (
        <div className="mt-8">
          <Banner tone="warning" title="What we need before we can approve you">
            {profile.statusNote}
          </Banner>
        </div>
      ) : null}

      <div className="mt-8 grid gap-10">
        <CompanyEditor profile={profile} members={null} />
        {waiting ? null : <SubmitBar blockers={blockers} resubmitting={profile.status === 'rejected'} />}
      </div>
    </PageContainer>
  )
}
