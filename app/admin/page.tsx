import { ArrowUpRight, RotateCcw } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ReportActions } from '@/components/admin/report-actions'
import { Button } from '@/components/ui/button'
import { ClampedText } from '@/components/ui/clamped-text'
import { EmptyState, StatusBadge } from '@/components/ui/feedback'
import { OrgLogo, TeamMark } from '@/components/ui/identity'
import { LinkPendingIndicator } from '@/components/ui/link-status'
import { LinkTabs } from '@/components/ui/link-tabs'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Pagination } from '@/components/ui/table'
import { requireAdmin } from '@/lib/server/authz'
import { listOpenReports, listPendingCompanies, listPitchQueue, listUnverifiedTeams, reviewCounts, WAITING_WARNING_MS } from '@/lib/server/data/admin-review'
import type { Page } from '@/lib/server/data/keyset'
import { guardPage } from '@/lib/server/page-guards'
import { cn } from '@/lib/shared/cn'
import { formatRelative, formatWaiting, pluralize } from '@/lib/shared/format'
import { SPONSOR_STATUS } from '@/lib/shared/labels'
import { placeLabel, reportReasonLabel } from '@/lib/shared/team'
import { displayWebsite } from '@/lib/shared/url'

export const metadata: Metadata = { title: 'Review' }

const TABS = ['pitches', 'companies', 'teams', 'reports'] as const
type Tab = (typeof TABS)[number]

const EMPTY: Record<Tab, string> = {
  pitches: 'No pitches are waiting for review. New ones appear here as teams submit them.',
  companies: 'No companies are waiting for approval.',
  teams: 'Every team on FTC Pitfund is verified.',
  reports: 'No open reports.',
}

const RECORD_LABEL = { matched: 'In FIRST records', manual: 'Not in FIRST records', unchecked: 'Not checked yet' } as const

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

export default async function AdminReviewPage({ searchParams }: PageProps<'/admin'>) {
  const [, params] = await Promise.all([guardPage(() => requireAdmin()), searchParams])
  const tab: Tab = TABS.includes(one(params.tab) as Tab) ? (one(params.tab) as Tab) : 'pitches'
  const page = { after: one(params.after) ?? null, before: one(params.before) ?? null }
  const now = new Date()

  const [counts, list] = await Promise.all([
    reviewCounts(),
    tab === 'pitches' ? listPitchQueue(page) : tab === 'companies' ? listPendingCompanies(page) : tab === 'teams' ? listUnverifiedTeams(page) : listOpenReports(page),
  ])
  const hrefFor = (t: Tab, cursor: { after?: string; before?: string } = {}) => {
    const sp = new URLSearchParams()
    if (t !== 'pitches') sp.set('tab', t)
    if (cursor.after) sp.set('after', cursor.after)
    if (cursor.before) sp.set('before', cursor.before)
    const query = sp.toString()
    return query ? `/admin?${query}` : '/admin'
  }
  const firstPitch = tab === 'pitches' && !page.after && !page.before ? (list as Page<{ id: string }>).items[0] : null

  return (
    <PageContainer width="review">
      <PageHeader
        title="Review"
        description="Everything waiting on an admin. Pitches reach a company only after you approve them."
        actions={
          firstPitch ? (
            <Button asChild>
              <Link href={`/admin/pitches/${firstPitch.id}`}>Start reviewing</Link>
            </Button>
          ) : null
        }
      />

      <LinkTabs
        label="Review queues"
        active={tab}
        tabs={[
          { key: 'pitches', label: 'Pitches', href: hrefFor('pitches'), count: counts.pitches },
          { key: 'companies', label: 'Companies', href: hrefFor('companies'), count: counts.companies },
          { key: 'teams', label: 'Teams', href: hrefFor('teams'), count: counts.teams },
          { key: 'reports', label: 'Reports', href: hrefFor('reports'), count: counts.reports },
        ]}
      />

      <div className="mt-6">
        {list.items.length === 0 ? (
          <EmptyState
            title="You’re all caught up"
            description={EMPTY[tab]}
            action={
              list.prevCursor || page.after || page.before ? (
                <Button asChild variant="secondary">
                  <Link href={hrefFor(tab)}>
                    <RotateCcw aria-hidden="true" />
                    Back to the start
                  </Link>
                </Button>
              ) : null
            }
            className="rounded-dialog border border-border bg-surface"
          />
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-dialog border border-border bg-surface" aria-label={`${tab} waiting`}>
              {tab === 'pitches'
                ? (list as Awaited<ReturnType<typeof listPitchQueue>>).items.map((p) => {
                    const late = now.getTime() - p.submittedAt.getTime() > WAITING_WARNING_MS
                    return (
                      <li key={p.id} className="relative flex min-w-0 flex-col gap-2 px-4 py-4 transition-colors duration-120 hover:bg-canvas sm:flex-row sm:items-center sm:gap-6 sm:px-5">
                        <Link href={`/admin/pitches/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2 after:absolute after:inset-0">
                          <TeamMark name={p.team.name} number={p.team.number} logoSrc={p.team.logoUrl} verified={p.team.verified} meta={`to ${p.company.name}`} />
                          <LinkPendingIndicator />
                        </Link>
                        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pl-[52px] sm:pl-0">
                          {p.resubmission ? <StatusBadge label="Resubmitted" tone="info" /> : null}
                          {p.company.status !== 'approved' ? <StatusBadge label={`Company ${SPONSOR_STATUS[p.company.status].label.toLowerCase()}`} tone="warning" /> : null}
                          <span className={cn('text-small tabular', late ? 'font-medium text-warning' : 'text-text-tertiary')}>{formatWaiting(p.submittedAt, now)}</span>
                        </div>
                      </li>
                    )
                  })
                : tab === 'companies'
                  ? (list as Awaited<ReturnType<typeof listPendingCompanies>>).items.map((c) => (
                      <li key={c.id} className="relative flex min-w-0 flex-col gap-2 px-4 py-4 transition-colors duration-120 hover:bg-canvas sm:flex-row sm:items-center sm:gap-6 sm:px-5">
                        <Link href={`/admin/companies/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 after:absolute after:inset-0">
                          <OrgLogo name={c.name} src={c.logoUrl} />
                          <span className="grid min-w-0">
                            <span className="flex min-w-0 items-center gap-2 text-body font-medium text-text">
                              <span className="min-w-0 user-text">{c.name}</span>
                              <LinkPendingIndicator />
                            </span>
                            <span className="min-w-0 text-small text-text-tertiary line-clamp-1 user-text">{displayWebsite(c.website)}</span>
                          </span>
                        </Link>
                        <div className="grid shrink-0 gap-0.5 pl-[52px] sm:max-w-80 sm:pl-0 sm:text-right">
                          <span className="min-w-0 text-small text-text-secondary line-clamp-1 user-text">{[c.applicantName, c.applicantTitle].filter(Boolean).join(' · ')}</span>
                          <span className="text-small text-text-tertiary">Applied {formatRelative(c.createdAt, now)}</span>
                        </div>
                      </li>
                    ))
                  : tab === 'teams'
                    ? (list as Awaited<ReturnType<typeof listUnverifiedTeams>>).items.map((t) => (
                        <li key={t.id} className="relative flex min-w-0 flex-col gap-2 px-4 py-4 transition-colors duration-120 hover:bg-canvas sm:flex-row sm:items-center sm:gap-6 sm:px-5">
                          <Link href={`/admin/teams/${t.id}`} className="flex min-w-0 flex-1 items-center gap-2 after:absolute after:inset-0">
                            <TeamMark name={t.name} number={t.number} logoSrc={t.logoUrl} meta={placeLabel(t) || null} />
                            <LinkPendingIndicator />
                          </Link>
                          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pl-[52px] sm:pl-0">
                            <StatusBadge label={RECORD_LABEL[t.recordStatus]} tone={t.recordStatus === 'matched' ? 'success' : t.recordStatus === 'manual' ? 'warning' : 'neutral'} />
                            {!t.hasDeck ? <span className="text-small text-text-tertiary">No deck</span> : null}
                            <span className="text-small text-text-tertiary">Joined {formatRelative(t.createdAt, now)}</span>
                          </div>
                        </li>
                      ))
                    : (list as Awaited<ReturnType<typeof listOpenReports>>).items.map((r) => (
                        <li key={r.id} className="grid min-w-0 gap-3 px-4 py-4 sm:px-5">
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                            <Link href={`/admin/teams/${r.team.id}`} className="flex min-w-0 items-center gap-2 rounded-control hover:underline hover:decoration-border-strong hover:underline-offset-4">
                              <TeamMark name={r.team.name} number={r.team.number} logoSrc={r.team.logoUrl} meta={r.team.suspended ? 'Suspended' : null} />
                              <LinkPendingIndicator />
                            </Link>
                            <span className="min-w-0 pl-[52px] text-small text-text-tertiary line-clamp-2 sm:max-w-[45%] sm:pl-0 sm:text-right">
                              Reported {formatRelative(r.createdAt, now)} by <span className="user-text">{r.reporter ?? 'an anonymous visitor'}</span>
                            </span>
                          </div>
                          <div className="grid min-w-0 gap-1.5 sm:pl-[52px]">
                            <p className="text-body font-medium text-text user-text">{reportReasonLabel(r.reason)}</p>
                            {r.details ? <ClampedText className="text-body text-text-secondary">{r.details}</ClampedText> : <p className="text-body text-text-tertiary">No details given.</p>}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 sm:pl-[52px]">
                            <a href={`/t/${r.team.number}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-small font-medium text-accent hover:text-accent-hover">
                              View the reported page
                              <ArrowUpRight aria-hidden="true" className="size-3.5" />
                            </a>
                            <ReportActions reportId={r.id} teamNumber={r.team.number} teamSuspended={r.team.suspended} />
                          </div>
                        </li>
                      ))}
            </ul>
            {list.nextCursor || list.prevCursor ? (
              <Pagination
                previousHref={list.prevCursor ? hrefFor(tab, { before: list.prevCursor }) : null}
                nextHref={list.nextCursor ? hrefFor(tab, { after: list.nextCursor }) : null}
                summary={pluralize(list.items.length, 'item') + ' on this page'}
              />
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  )
}
