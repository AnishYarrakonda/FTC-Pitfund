import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { OrgLogo } from '@/components/ui/identity'
import { cn } from '@/lib/shared/cn'
import type { Question } from '@/lib/shared/questions'
import { displayWebsite } from '@/lib/shared/url'

import { sponsorPlace, supportTypesLabel, type SponsorSummaryData } from './sponsor-summary'

export type SponsorProfileData = SponsorSummaryData & { website: string; questions: Question[]; usesDefaultQuestions: boolean }

/**
 * A company's profile exactly as coaches see it on /sponsors/[id]: header, what it looks for, the
 * support it offers and the questions a pitch answers. The company editor's "What teams see"
 * preview renders the same component (`preview` shrinks the type and drops the h1).
 */
export function SponsorProfile({
  sponsor,
  action,
  notice,
  preview = false,
}: {
  sponsor: SponsorProfileData
  action?: ReactNode
  notice?: ReactNode
  preview?: boolean
}) {
  const place = sponsorPlace(sponsor)
  const Title = preview ? 'p' : 'h1'
  const Heading = preview ? 'h3' : 'h2'
  return (
    <div className="min-w-0">
      <header className={cn('flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between', preview && 'gap-4 sm:flex-col')}>
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <OrgLogo name={sponsor.name || 'Company'} src={sponsor.logoUrl} size={preview ? 'md' : 'lg'} />
          <div className="grid min-w-0 gap-1">
            <Title className={cn('font-semibold tracking-tighter text-text user-text', preview ? 'text-h3' : 'text-h2')}>{sponsor.name || 'Your company'}</Title>
            {place ? <p className="line-clamp-2 text-body text-text-secondary user-text">{place}</p> : null}
            {sponsor.website ? (
              <a href={sponsor.website} target="_blank" rel="noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1 text-small font-medium text-accent hover:text-accent-hover">
                <span className="min-w-0 line-clamp-1 user-text">{displayWebsite(sponsor.website)}</span>
                <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
              </a>
            ) : null}
          </div>
        </div>
        {action}
      </header>

      {notice}

      <div className={cn('grid gap-10', preview ? 'mt-6 gap-6' : 'mt-10')}>
        <section className="grid gap-2" aria-label="What we look for">
          <Heading className="text-small font-medium text-text-tertiary">What we look for</Heading>
          {sponsor.about ? (
            <p className={cn('text-text user-text-block', preview ? 'line-clamp-6 text-body' : 'text-lead')}>{sponsor.about}</p>
          ) : (
            <p className="text-body text-text-tertiary">{sponsor.name || 'This company'} hasn&apos;t described what it looks for yet.</p>
          )}
          {sponsor.supportTypes.length ? <p className="mt-2 text-body text-text-secondary">Offers {supportTypesLabel(sponsor.supportTypes).toLowerCase()}</p> : null}
        </section>

        <section className={cn('grid gap-4 border-t border-border', preview ? 'pt-6' : 'pt-8')} aria-label="Questions">
          <div className="grid gap-1">
            <Heading className={cn('font-semibold tracking-tight text-text', preview ? 'text-body' : 'text-lead')}>You&apos;ll be asked</Heading>
            <p className="text-body text-text-secondary">
              {sponsor.usesDefaultQuestions
                ? `${sponsor.name || 'This company'} uses FTC Pitfund’s standard questions. There are no minimum lengths; be specific.`
                : `Every pitch to ${sponsor.name || 'this company'} answers these. There are no minimum lengths; be specific.`}
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
    </div>
  )
}
