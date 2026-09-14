import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ConnectedPanel } from '@/components/pitch/connected-panel'
import { PitchView } from '@/components/pitch/pitch-view'
import { Banner, StatusBadge, Timeline } from '@/components/ui/feedback'
import { OrgLogo } from '@/components/ui/identity'
import { PageContainer } from '@/components/ui/page'
import { requireTeamMember } from '@/lib/server/authz'
import { getTeamPitch } from '@/lib/server/data/pitches'
import { guardPage } from '@/lib/server/page-guards'
import { AppError } from '@/lib/server/result'
import { PITCH_STATUS } from '@/lib/shared/labels'
import { nextStep } from '@/lib/shared/pitch'
import { pitchSeason, seasonLabel } from '@/lib/shared/season'

import { PitchActions } from './pitch-actions'

export const metadata: Metadata = { title: 'Pitch' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PitchPage({ params }: PageProps<'/pitches/[id]'>) {
  const [viewer, { id }] = await Promise.all([guardPage(() => requireTeamMember()), params])
  if (!UUID.test(id)) notFound()
  const pitch = await getTeamPitch(viewer, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound()
    throw e
  })
  const company = pitch.view.company
  const status = PITCH_STATUS[pitch.status]
  const currentSeason = pitch.season === pitchSeason()

  return (
    <PageContainer width="review">
      <Link href="/pitches" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Pitches
      </Link>

      <header className="mt-6 flex flex-col gap-5 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <OrgLogo name={company.name} src={company.logoUrl} size="lg" />
          <div className="grid min-w-0 gap-1.5">
            <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">Pitch to {company.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-secondary">
              <StatusBadge label={status.label} tone={status.tone} />
              <span className="min-w-0">{nextStep(pitch.status, company.name)}</span>
              <span className="text-small text-text-tertiary">{seasonLabel(pitch.season)} season</span>
            </p>
          </div>
        </div>
        <PitchActions pitchId={pitch.id} sponsorId={company.id} companyName={company.name} status={pitch.status} />
      </header>

      <div className="mt-8 grid gap-4 empty:hidden">
        {pitch.status === 'changes_requested' && pitch.reviewNote ? (
          <Banner tone="warning" title="A reviewer sent this back with a note">
            <span className="user-text-block">{pitch.reviewNote}</span>
          </Banner>
        ) : null}
        {pitch.status === 'rejected' ? (
          <Banner tone="danger" title="This pitch wasn’t approved">
            {pitch.reviewNote ? <span className="user-text-block">{pitch.reviewNote}</span> : `It won’t be sent to ${company.name}. You’re welcome to pitch other companies.`}
          </Banner>
        ) : null}
        {pitch.status === 'declined' ? (
          <Banner tone="info" title={`${company.name} isn’t a fit this time`}>
            {pitch.declineReason ? <span className="user-text-block">{pitch.declineReason}</span> : 'They didn’t give a reason. Keep pitching the companies that match your team.'}
          </Banner>
        ) : null}
        {pitch.status === 'withdrawn' ? (
          <Banner
            tone="info"
            title="You withdrew this pitch"
            action={
              currentSeason ? (
                <Link href={`/sponsors/${company.id}`} className="text-body font-medium text-accent hover:text-accent-hover">
                  Pitch {company.name} again
                </Link>
              ) : null
            }
          >
            {currentSeason ? `You can pitch ${company.name} again this season.` : 'It stays here for your records.'}
          </Banner>
        ) : null}
        {pitch.status === 'matched' && pitch.contact ? (
          <ConnectedPanel
            title={`Connected with ${company.name}`}
            description="We emailed you both. Reach out and take it from here."
            contact={{ name: pitch.contact.name, email: pitch.contact.email, phone: pitch.contact.phone, jobTitle: pitch.contact.jobTitle, website: pitch.contact.website }}
          />
        ) : null}
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <section aria-labelledby="pitch-heading" className="min-w-0">
          <h2 id="pitch-heading" className="mb-6 text-small font-medium text-text-tertiary">
            The pitch, as {company.name} sees it
          </h2>
          <PitchView pitch={pitch.view} headingLevel={3} />
        </section>
        <aside aria-labelledby="timeline-heading" className="min-w-0">
          <div className="lg:sticky lg:top-24">
            <h2 id="timeline-heading" className="mb-5 text-small font-medium text-text-tertiary">
              Timeline
            </h2>
            <Timeline
              events={[...pitch.timeline].reverse().map((e) => ({
                id: e.id,
                at: e.at,
                tone: e.tone,
                title: e.title,
                description:
                  e.note || e.description ? (
                    <span className="grid gap-1">
                      {e.note ? <span className="user-text-block">{e.note}</span> : null}
                      {e.description ? <span className="text-small text-warning">{e.description}</span> : null}
                    </span>
                  ) : undefined,
              }))}
            />
          </div>
        </aside>
      </div>
    </PageContainer>
  )
}
