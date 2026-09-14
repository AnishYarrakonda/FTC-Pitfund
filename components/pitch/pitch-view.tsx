import { ArrowUpRight, FileText } from 'lucide-react'
import type { ReactNode } from 'react'

import { TeamMark } from '@/components/ui/identity'
import { cn } from '@/lib/shared/cn'
import { formatDate } from '@/lib/shared/format'
import type { PitchViewData } from '@/lib/shared/pitch'
import { placeLabel } from '@/lib/shared/team'
import { displayWebsite } from '@/lib/shared/url'

/**
 * A pitch exactly as the company sees it (plan §3.2): team header, answers, the ask and the deck.
 * Shared by the composer preview, the coach's pitch page, the admin review and the company inbox
 * (prompt 3). It has no hooks, so it renders on the server or inside a client component.
 *
 * `deck`: 'card' shows the page-1 thumbnail with an "Open deck" link; 'none' when the page
 * embeds the full PdfViewer itself.
 */
export function PitchView({
  pitch,
  deck = 'card',
  headerAside,
  className,
  headingLevel = 2,
}: {
  pitch: PitchViewData
  deck?: 'card' | 'none'
  headerAside?: ReactNode
  className?: string
  headingLevel?: 2 | 3
}) {
  const { team, ask, answers } = pitch
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const place = placeLabel(team)

  return (
    <article className={cn('grid min-w-0 gap-8', className)} aria-label={`Pitch from Team ${team.number} to ${pitch.company.name}`}>
      <header className="grid min-w-0 gap-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <TeamMark name={team.name} number={team.number} logoSrc={team.logoUrl} verified={team.verified} meta={place || null} size="md" />
          {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
        </div>
        {team.summary ? (
          <p className="text-lead text-text user-text">{team.summary}</p>
        ) : (
          <p className="text-body text-text-tertiary">No one-line summary yet.</p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-small">
          <a href={`/t/${team.number}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">
            Team page
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
          {team.website ? (
            <a href={team.website} target="_blank" rel="noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1 text-text-secondary hover:text-text">
              <span className="min-w-0 user-text">{displayWebsite(team.website)}</span>
              <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
            </a>
          ) : null}
          {pitch.submittedAt ? <span className="text-text-tertiary">Submitted {formatDate(pitch.submittedAt)}</span> : null}
        </div>
      </header>

      <section className="grid min-w-0 gap-2 border-t border-border pt-6" aria-label="Ask">
        <Heading className="text-small font-medium text-text-tertiary">The ask</Heading>
        {ask.label ? (
          <div className="grid min-w-0 gap-1">
            <p className="text-lead font-semibold text-text tabular">{ask.label}</p>
            {ask.note ? <p className="text-body text-text-secondary user-text-block">{ask.note}</p> : null}
          </div>
        ) : (
          <p className="text-body text-text-secondary">No specific ask. The team would like to hear what support fits.</p>
        )}
      </section>

      <section className="grid min-w-0 gap-6 border-t border-border pt-6" aria-label="Answers">
        <Heading className="sr-only">Answers</Heading>
        <ol className="grid min-w-0 gap-6">
          {answers.map((a, i) => (
            <li key={a.questionId} className="grid min-w-0 gap-1.5">
              <p className="flex min-w-0 gap-2 text-body font-medium text-text">
                <span className="shrink-0 text-text-tertiary tabular">{i + 1}.</span>
                <span className="min-w-0 user-text">{a.prompt}</span>
              </p>
              {a.answer.trim() ? (
                <p className="pl-6 text-body text-text-secondary user-text-block">{a.answer}</p>
              ) : (
                <p className="pl-6 text-body text-text-tertiary">Not answered</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {deck === 'card' ? (
        <section className="grid min-w-0 gap-3 border-t border-border pt-6" aria-label="Sponsorship deck">
          <Heading className="text-small font-medium text-text-tertiary">Sponsorship deck</Heading>
          {team.deck ? (
            <a
              href={team.deck.url}
              target="_blank"
              rel="noreferrer"
              className="group flex min-w-0 items-center gap-4 rounded-menu border border-border bg-surface p-3 transition-colors duration-120 hover:border-border-strong"
            >
              <span className="relative block aspect-[612/792] w-16 shrink-0 overflow-hidden rounded-control border border-border bg-canvas">
                {team.deck.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- storage-hosted page-1 thumbnail
                  <img src={team.deck.thumbUrl} alt="" className="size-full object-cover object-top" loading="lazy" />
                ) : (
                  <FileText aria-hidden="true" className="absolute inset-0 m-auto size-5 text-text-tertiary" />
                )}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="inline-flex items-center gap-1 text-body font-medium text-text group-hover:text-accent">
                  Open deck
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </span>
                <span className="text-small text-text-tertiary">
                  PDF · {team.deck.pages} {team.deck.pages === 1 ? 'page' : 'pages'}
                </span>
              </span>
            </a>
          ) : (
            <p className="text-body text-text-tertiary">No deck uploaded yet.</p>
          )}
        </section>
      ) : null}
    </article>
  )
}
