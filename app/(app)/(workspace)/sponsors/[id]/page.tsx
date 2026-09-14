import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PitchStateAction } from '@/components/sponsors/pitch-state-action'
import { sponsorPlace, supportTypesLabel } from '@/components/sponsors/sponsor-summary'
import { Banner } from '@/components/ui/feedback'
import { OrgLogo } from '@/components/ui/identity'
import { PageContainer } from '@/components/ui/page'
import { requireTeamMember } from '@/lib/server/authz'
import { getDirectorySponsor, teamPitchesBySponsor } from '@/lib/server/data/directory'
import { getTeamSetup } from '@/lib/server/data/teams'
import { guardPage } from '@/lib/server/page-guards'
import { directoryState, nextStep } from '@/lib/shared/pitch'
import { displayWebsite } from '@/lib/shared/url'

export const metadata: Metadata = { title: 'Company' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function SponsorPage({ params }: PageProps<'/sponsors/[id]'>) {
  const [viewer, { id }] = await Promise.all([guardPage(() => requireTeamMember()), params])
  if (!UUID.test(id)) notFound()
  const [sponsor, statuses, setup] = await Promise.all([getDirectorySponsor(id), teamPitchesBySponsor(viewer), getTeamSetup(viewer)])
  if (!sponsor) notFound()
  const state = directoryState(sponsor.id, statuses[sponsor.id])
  const place = sponsorPlace(sponsor)
  const missing = [!setup.hasDeck && 'a sponsorship deck', !setup.hasSummary && 'a one-line summary'].filter(Boolean) as string[]

  return (
    <PageContainer width="reading">
      <Link href="/sponsors" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Sponsors
      </Link>

      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <OrgLogo name={sponsor.name} src={sponsor.logoUrl} size="lg" />
          <div className="grid min-w-0 gap-1">
            <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">{sponsor.name}</h1>
            {place ? <p className="line-clamp-2 text-body text-text-secondary user-text">{place}</p> : null}
            <a href={sponsor.website} target="_blank" rel="noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1 text-small font-medium text-accent hover:text-accent-hover">
              <span className="min-w-0 user-text">{displayWebsite(sponsor.website)}</span>
              <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
            </a>
          </div>
        </div>
        <div className="grid shrink-0 justify-items-start gap-1.5 sm:max-w-60 sm:justify-items-end">
          <PitchStateAction sponsorId={sponsor.id} sponsorName={sponsor.name} state={state} size="md" />
          {state.kind === 'pitch' ? <p className="text-small text-text-tertiary sm:text-right">{nextStep(state.status, sponsor.name)}</p> : null}
        </div>
      </header>

      {state.kind === 'start' && missing.length ? (
        <Banner tone="info" title="You can start drafting now" className="mt-8" action={<Link href="/team" className="text-body font-medium text-accent hover:text-accent-hover">Finish your profile</Link>}>
          Submitting needs {missing.join(' and ')} on your team profile.
        </Banner>
      ) : null}

      <div className="mt-10 grid gap-10">
        <section className="grid gap-2" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-small font-medium text-text-tertiary">
            What we look for
          </h2>
          {sponsor.about ? (
            <p className="text-lead text-text user-text-block">{sponsor.about}</p>
          ) : (
            <p className="text-body text-text-tertiary">{sponsor.name} hasn&apos;t described what it looks for yet.</p>
          )}
          {sponsor.supportTypes.length ? <p className="mt-2 text-body text-text-secondary">Offers {supportTypesLabel(sponsor.supportTypes).toLowerCase()}</p> : null}
        </section>

        <section className="grid gap-4 border-t border-border pt-8" aria-labelledby="questions-heading">
          <div className="grid gap-1">
            <h2 id="questions-heading" className="text-lead font-semibold tracking-tight text-text">
              You&apos;ll be asked
            </h2>
            <p className="text-body text-text-secondary">
              {sponsor.usesDefaultQuestions
                ? `${sponsor.name} uses FTC Pitfund’s standard questions. There are no minimum lengths; be specific.`
                : `Every pitch to ${sponsor.name} answers these. There are no minimum lengths; be specific.`}
            </p>
          </div>
          <ol className="grid gap-5">
            {sponsor.questions.map((q, i) => (
              <li key={q.id} className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-x-2 gap-y-1">
                <span className="text-body text-text-tertiary tabular">{i + 1}.</span>
                <div className="grid min-w-0 gap-1">
                  <p className="text-body font-medium text-text user-text">
                    {q.prompt}
                    <span className="ml-2 text-small font-normal text-text-tertiary">{q.required ? 'Required' : 'Optional'}</span>
                  </p>
                  {q.help ? <p className="text-small text-text-secondary user-text">{q.help}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PageContainer>
  )
}
