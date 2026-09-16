import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PitchStateAction } from '@/components/sponsors/pitch-state-action'
import { SponsorProfile } from '@/components/sponsors/sponsor-profile'
import { Banner } from '@/components/ui/feedback'
import { PageContainer } from '@/components/ui/page'
import { requireApprovedTeam } from '@/lib/server/authz'
import { getDirectorySponsor, teamPitchesBySponsor } from '@/lib/server/data/directory'
import { getTeamSetup } from '@/lib/server/data/teams'
import { guardPage } from '@/lib/server/page-guards'
import { directoryState, nextStep } from '@/lib/shared/pitch'

export const metadata: Metadata = { title: 'Company' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function SponsorPage({ params }: PageProps<'/sponsors/[id]'>) {
  const [viewer, { id }] = await Promise.all([guardPage(() => requireApprovedTeam()), params])
  if (!UUID.test(id)) notFound()
  const [sponsor, statuses, setup] = await Promise.all([getDirectorySponsor(id), teamPitchesBySponsor(viewer), getTeamSetup(viewer)])
  if (!sponsor) notFound()
  const state = directoryState(sponsor.id, statuses[sponsor.id])
  const missing = [!setup.hasDeck && 'a sponsorship deck', !setup.hasSummary && 'a one-line summary'].filter(Boolean) as string[]

  return (
    <PageContainer width="reading">
      <Link href="/sponsors" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Sponsors
      </Link>

      <div className="mt-6">
        <SponsorProfile
          sponsor={sponsor}
          action={
            <div className="grid shrink-0 justify-items-start gap-1.5 sm:max-w-60 sm:justify-items-end">
              <PitchStateAction sponsorId={sponsor.id} sponsorName={sponsor.name} state={state} size="md" />
              {state.kind === 'pitch' ? <p className="text-small text-text-tertiary sm:text-right">{nextStep(state.status, sponsor.name)}</p> : null}
            </div>
          }
          notice={
            state.kind === 'start' && missing.length ? (
              <Banner tone="info" title="You can start drafting now" className="mt-8" action={<Link href="/team" className="text-body font-medium text-accent hover:text-accent-hover">Finish your profile</Link>}>
                Submitting needs {missing.join(' and ')} on your team profile.
              </Banner>
            ) : null
          }
        />
      </div>
    </PageContainer>
  )
}
