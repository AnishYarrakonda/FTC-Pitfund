import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DeckSection } from '@/app/(app)/(workspace)/team/deck-section'
import { ProfileForm } from '@/app/(app)/(workspace)/team/profile-form'
import { Banner } from '@/components/ui/banner'
import { PageContainer } from '@/components/ui/page'
import { requireTeamMember } from '@/lib/server/authz'
import { getTeamProfile, submitBlockers } from '@/lib/server/data/teams'
import { pageViewer } from '@/lib/server/page-guards'
import { homeFor, welcomePath } from '@/lib/shared/viewer'

import { ProofUpload } from './proof-upload'
import { SubmitBar } from './submit-bar'
import { TeamSetup } from './team-setup'

export const metadata: Metadata = { title: 'Set up your team' }

/**
 * Coach first run. Two halves: find the team by its FTC number and claim it, then fill in what an
 * admin needs to see and send it for review. A team stays a draft — invisible, unable to pitch —
 * until that review passes, which is what stops anyone claiming a team number that isn't theirs.
 */
export default async function WelcomeTeamPage() {
  const viewer = await pageViewer()
  if (viewer.sponsor || viewer.pendingJoin) redirect(homeFor(viewer))
  // /welcome is where the 18+ and Terms confirmation is collected; nobody sets up an org around it.
  if (!viewer.acceptedTermsAt) redirect(welcomePath('team'))
  // No team yet: look one up and claim it.
  if (!viewer.team) return <Shell>{<TeamSetup />}</Shell>
  if (viewer.team.status === 'approved' || viewer.team.status === 'suspended') redirect(homeFor(viewer))

  const teamViewer = await requireTeamMember({ viewer })
  const profile = await getTeamProfile(teamViewer)
  const blockers = submitBlockers(profile)
  const waiting = profile.status === 'pending'

  return (
    <PageContainer width="form" className="sm:pt-16">
      <header className="grid gap-2">
        <h1 className="text-h1 font-semibold tracking-tighter text-text">
          {waiting ? `Team ${profile.number}, waiting for review` : `Tell us about Team ${profile.number}`}
        </h1>
        <p className="text-lead text-text-secondary">
          {waiting
            ? 'You can still change any of this while you wait — it goes back into the same queue.'
            : 'This is what an FTC Pitfund admin checks, and what companies see once you’re approved.'}
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
        <ProfileForm profile={profile} />
        <DeckSection deck={profile.deck} />
        <ProofSection uploaded={profile.hasProof} />
        {waiting ? null : <SubmitBar blockers={blockers} resubmitting={profile.status === 'rejected'} />}
      </div>
    </PageContainer>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer width="form" className="sm:pt-16">
      <Link href="/welcome" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>
      <header className="mt-6 grid gap-2">
        <h1 className="text-h1 font-semibold tracking-tighter text-text">Set up your team</h1>
        <p className="text-lead text-text-secondary">
          Find your team by its FTC number or name. Your team gets one shared account that every coach on it can use.
        </p>
      </header>
      {children}
    </PageContainer>
  )
}

function ProofSection({ uploaded }: { uploaded: boolean }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-lead font-semibold tracking-tight text-text">Proof you coach this team</h2>
      <ProofUpload uploaded={uploaded} />
    </section>
  )
}
