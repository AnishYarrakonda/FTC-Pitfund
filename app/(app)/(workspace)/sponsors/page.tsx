import type { Metadata } from 'next'
import Link from 'next/link'

import { PitchStateAction } from '@/components/sponsors/pitch-state-action'
import { SponsorRow } from '@/components/sponsors/sponsor-summary'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Pagination } from '@/components/ui/table'
import { requireApprovedTeam } from '@/lib/server/authz'
import {
  countApprovedSponsors,
  listDirectory,
  queryDirectory,
  SEARCH_RESULT_LIMIT,
  teamPitchesBySponsor,
  type PitchFilter,
} from '@/lib/server/data/directory'
import { guardPage } from '@/lib/server/page-guards'
import { directoryState } from '@/lib/shared/pitch'
import { PITCH_FILTERS, pitchFilterCounts, sponsorIdsFor } from '@/lib/shared/directory'

import { DirectoryControls } from './directory-controls'

export const metadata: Metadata = { title: 'Sponsors' }

// The guard redirects an org that isn't approved yet, so this route can't be validated as instant —
// the same reason the workspace layout opts out.
export const instant = false

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

export default async function SponsorsPage({ searchParams }: PageProps<'/sponsors'>) {
  const [viewer, params] = await Promise.all([guardPage(() => requireApprovedTeam()), searchParams])
  const q = (one(params.q) ?? '').slice(0, 100)
  const show = PITCH_FILTERS.includes(one(params.show) as PitchFilter) ? (one(params.show) as PitchFilter) : 'all'
  const after = one(params.after) ?? null
  const before = one(params.before) ?? null

  // What this team has already done is the useful way to cut the list down — a company's "type" was
  // never something a sponsor really had. It's per-team, so it can't live inside the cached query.
  const [statuses, total] = await Promise.all([teamPitchesBySponsor(viewer), countApprovedSponsors()])
  const counts = pitchFilterCounts(statuses, total)
  const filter = show === 'all' ? undefined : { kind: show, ids: sponsorIdsFor(statuses, show) }
  const page = filter ? await queryDirectory({ q, after, before, filter }) : await listDirectory({ q, after, before })

  const searching = Boolean(q)
  const filtered = searching || show !== 'all'

  const hrefWith = (cursor: { after?: string; before?: string }) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (show !== 'all') sp.set('show', show)
    if (cursor.after) sp.set('after', cursor.after)
    if (cursor.before) sp.set('before', cursor.before)
    return `/sponsors?${sp.toString()}`
  }

  return (
    <PageContainer>
      <PageHeader title="Sponsors" description="Companies on FTC Pitfund that want pitches from FTC teams. Each one asks its own questions." />
      <DirectoryControls q={q} show={show} counts={counts}>
        {page.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No companies match"
              description={
                searching
                  ? `Nothing close to “${q}”. Try fewer letters, or part of the name.`
                  : show === 'not_pitched'
                    ? 'You’ve already pitched every company here this season.'
                    : 'Nothing here yet.'
              }
              action={
                <Button asChild variant="secondary">
                  <Link href="/sponsors">Show all companies</Link>
                </Button>
              }
              className="rounded-dialog border border-border bg-surface"
            />
          ) : (
            <EmptyState
              title="No companies yet"
              description="Companies are joining FTC Pitfund. Check back soon. Meanwhile, finish your team profile."
              action={
                <Button asChild>
                  <Link href="/team">Finish your team profile</Link>
                </Button>
              }
              className="rounded-dialog border border-border bg-surface"
            />
          )
        ) : (
          <>
            <ul className="divide-y divide-border rounded-dialog border border-border bg-surface" aria-label="Companies">
              {page.items.map((sponsor) => (
                <li key={sponsor.id}>
                  <SponsorRow
                    sponsor={sponsor}
                    href={`/sponsors/${sponsor.id}`}
                    action={<PitchStateAction sponsorId={sponsor.id} sponsorName={sponsor.name} state={directoryState(sponsor.id, statuses[sponsor.id])} />}
                  />
                </li>
              ))}
            </ul>
            {searching ? (
              <p className="text-small text-text-tertiary" role="status">
                {page.items.length === SEARCH_RESULT_LIMIT
                  ? `Closest ${SEARCH_RESULT_LIMIT} matches, best first. Type more to narrow it down.`
                  : `${page.items.length} ${page.items.length === 1 ? 'match' : 'matches'}, best first.`}
              </p>
            ) : page.nextCursor || page.prevCursor ? (
              <Pagination
                previousHref={page.prevCursor ? hrefWith({ before: page.prevCursor }) : null}
                nextHref={page.nextCursor ? hrefWith({ after: page.nextCursor }) : null}
                summary={`${page.items.length} companies on this page`}
              />
            ) : null}
          </>
        )}
      </DirectoryControls>
    </PageContainer>
  )
}
