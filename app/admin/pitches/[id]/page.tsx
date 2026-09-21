import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { ReviewDecisions } from '@/components/admin/review-decisions'
import { PitchView } from '@/components/pitch/pitch-view'
import { ClampedText } from '@/components/ui/clamped-text'
import { Facts } from '@/components/ui/facts'
import { Banner, StatusBadge } from '@/components/ui/feedback'
import { OrgLogo } from '@/components/ui/identity'
import { PageContainer } from '@/components/ui/page'
import { PdfViewer } from '@/components/ui/pdf-viewer'
import { requireAdmin } from '@/lib/server/authz'
import { getPitchReview, WAITING_WARNING_MS } from '@/lib/server/data/admin-review'
import { guardPage } from '@/lib/server/page-guards'
import { AppError } from '@/lib/server/result'
import { cn } from '@/lib/shared/cn'
import { formatDate, formatDateTime, formatWaiting } from '@/lib/shared/format'
import { PITCH_STATUS, ORG_STATUS } from '@/lib/shared/labels'
import { displayWebsite } from '@/lib/shared/url'

export const metadata: Metadata = { title: 'Review pitch' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RECORD = { matched: 'Found in FIRST records', manual: 'Not found in FIRST records', unchecked: 'Not checked yet' } as const

const DECIDED: Partial<Record<string, string>> = { sent: 'approved and sent', matched: 'approved and sent', declined: 'approved and sent', changes_requested: 'sent back', rejected: 'rejected' }

export default async function AdminPitchPage({ params }: PageProps<'/admin/pitches/[id]'>) {
  const [admin, { id }] = await Promise.all([guardPage(() => requireAdmin()), params])
  if (!UUID.test(id)) notFound()
  const review = await getPitchReview(admin, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound()
    throw e
  })
  const { team, company, queue } = review
  const now = new Date()
  const inReview = review.status === 'in_review'
  const late = inReview && review.submittedAt && now.getTime() - review.submittedAt.getTime() > WAITING_WARNING_MS
  const status = PITCH_STATUS[review.status]

  return (
    <PageContainer width="review" className={inReview ? 'pb-40 lg:pb-16' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Review
        </Link>
        <nav aria-label="Review queue" className="flex items-center gap-2 text-small text-text-tertiary">
          <span className="tabular">{queue.position ? `${queue.position} of ${queue.total} in review` : `${queue.total} in review`}</span>
          <QueueLink href={queue.previousId ? `/admin/pitches/${queue.previousId}` : null} label="Previous pitch">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </QueueLink>
          <QueueLink href={queue.nextId ? `/admin/pitches/${queue.nextId}` : null} label="Next pitch">
            <ChevronRight aria-hidden="true" className="size-4" />
          </QueueLink>
        </nav>
      </div>

      <header className="mt-6 grid gap-2 border-b border-border pb-6">
        <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">
          Team {team.number} · {team.name} <span className="text-text-tertiary">→</span> {company.name}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-secondary">
          <StatusBadge label={status.label} tone={status.tone} />
          {review.resubmission ? <StatusBadge label="Resubmitted" tone="info" /> : null}
          {review.submittedAt ? (
            <span className={cn(late && 'font-medium text-warning')}>
              Submitted {formatDateTime(review.submittedAt)}
              {inReview ? ` · ${formatWaiting(review.submittedAt, now)}` : ''}
            </span>
          ) : null}
        </p>
      </header>

      {!inReview ? (
        <Banner
          tone="info"
          className="mt-6"
          title={
            DECIDED[review.status]
              ? `${review.reviewedByName ?? 'An admin'} ${DECIDED[review.status]} this pitch${review.reviewedAt ? ` on ${formatDate(review.reviewedAt)}` : ''}.`
              : review.status === 'withdrawn'
                ? `Team ${team.number} withdrew this pitch.`
                : 'This pitch isn’t waiting for review.'
          }
          action={
            queue.nextId ? (
              <Link href={`/admin/pitches/${queue.nextId}`} className="text-body font-medium text-accent hover:text-accent-hover">
                Next in queue
              </Link>
            ) : null
          }
        >
          {review.reviewNote && (review.status === 'changes_requested' || review.status === 'rejected') ? <ClampedText lines={4}>{`Note: ${review.reviewNote}`}</ClampedText> : null}
        </Banner>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="grid min-w-0 content-start gap-8">
          <section aria-labelledby="pitch-heading" className="min-w-0">
            <h2 id="pitch-heading" className="mb-6 text-small font-medium text-text-tertiary">
              The pitch, exactly as {company.name} will see it
            </h2>
            <PitchView pitch={review.view} deck="none" headingLevel={3} />
          </section>
          <section aria-labelledby="deck-heading" className="grid gap-3 border-t border-border pt-6">
            <h2 id="deck-heading" className="text-small font-medium text-text-tertiary">
              Sponsorship deck
            </h2>
            {review.deck ? (
              <PdfViewer src={review.deck.url} downloadHref={review.deck.downloadUrl} title={`Team ${team.number} sponsorship deck`} pages={review.deck.pages} thumbnailSrc={review.deck.thumbUrl} />
            ) : (
              <p className="rounded-menu bg-canvas px-5 py-10 text-center text-body text-text-secondary">No deck uploaded.</p>
            )}
          </section>
        </div>

        <aside className="min-w-0" aria-label="Decision and facts">
          <div className="grid gap-6 lg:sticky lg:top-20">
            {inReview ? (
              <ReviewDecisions pitchId={review.id} teamNumber={team.number} companyName={company.name} blocker={review.approvalBlocker} previousId={queue.previousId} nextId={queue.nextId} />
            ) : null}

            <FactsCard
              title="Team"
              action={
                <Link href={`/admin/teams/${team.id}`} className="text-small font-medium text-accent hover:text-accent-hover">
                  Open team
                </Link>
              }
            >
              <Facts
                rows={[
                  { label: 'Verified', value: team.verified ? 'Yes' : <span className="text-warning">Not yet</span> },
                  team.suspended ? { label: 'Status', value: <span className="text-danger">Suspended</span> } : null,
                  { label: 'Joined', value: formatDate(team.createdAt) },
                  {
                    label: 'FIRST record',
                    value: (
                      <span className="grid gap-0.5">
                        <span>{RECORD[team.recordStatus]}</span>
                        {team.record ? <span className="text-text-tertiary">{[team.record.name, team.record.city, team.record.state].filter(Boolean).join(', ')}</span> : null}
                      </span>
                    ),
                  },
                  {
                    label: 'Coaches',
                    value: (
                      <ul className="grid gap-1.5">
                        {team.members.map((m) => (
                          <li key={m.email} className="grid min-w-0">
                            <span className="line-clamp-1">{m.name}</span>
                            <a href={`mailto:${m.email}`} className="line-clamp-1 text-text-tertiary hover:text-text">
                              {m.email}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-small">
                <ExternalLink href={`/t/${team.number}`}>Public page</ExternalLink>
                <ExternalLink href={`https://ftcscout.org/teams/${team.number}`}>FTCScout</ExternalLink>
              </div>
              {team.otherPitches.length ? (
                <div className="grid gap-2 border-t border-border pt-3">
                  <p className="text-small text-text-tertiary">Other pitches this team sent</p>
                  <ul className="grid gap-1.5">
                    {team.otherPitches.map((p) => (
                      <li key={p.id} className="flex min-w-0 items-center justify-between gap-3">
                        <Link href={`/admin/pitches/${p.id}`} className="min-w-0 text-small text-text line-clamp-1 hover:underline">
                          {p.companyName}
                        </Link>
                        <StatusBadge label={PITCH_STATUS[p.status].label} tone={PITCH_STATUS[p.status].tone} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="border-t border-border pt-3 text-small text-text-tertiary">This is the team’s first pitch.</p>
              )}
            </FactsCard>

            <FactsCard
              title="Company"
              action={
                <Link href={`/admin/companies/${company.id}`} className="text-small font-medium text-accent hover:text-accent-hover">
                  Open company
                </Link>
              }
            >
              <div className="flex min-w-0 items-center gap-3">
                <OrgLogo name={company.name} src={company.logoUrl} size="sm" />
                <span className="min-w-0 text-body font-medium text-text user-text">{company.name}</span>
              </div>
              <Facts
                rows={[
                  { label: 'Status', value: <StatusBadge label={ORG_STATUS[company.status].label} tone={ORG_STATUS[company.status].tone} /> },
                  { label: 'Website', value: <ExternalLink href={company.website}>{displayWebsite(company.website)}</ExternalLink> },
                  { label: 'People notified', value: company.memberCount },
                  { label: 'Questions', value: company.questionCount ? `${company.questionCount} of its own` : 'Default questions' },
                ]}
              />
            </FactsCard>
          </div>
        </aside>
      </div>
    </PageContainer>
  )
}

function FactsCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4 rounded-dialog border border-border bg-surface p-5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-semibold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium text-accent hover:text-accent-hover">
      <span className="min-w-0 line-clamp-1">{children}</span>
      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

function QueueLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  const cls = 'grid size-8 place-items-center rounded-control border'
  if (!href)
    return (
      <button type="button" disabled aria-label={label} className={cn(cls, 'cursor-not-allowed border-border text-text-tertiary/60')}>
        {children}
      </button>
    )
  return (
    <Link href={href} aria-label={label} className={cn(cls, 'border-border-strong bg-surface text-text-secondary hover:bg-muted hover:text-text')}>
      {children}
    </Link>
  )
}
