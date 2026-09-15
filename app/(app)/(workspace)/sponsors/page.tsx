import type { Metadata } from 'next'
import Link from 'next/link'

import { PitchStateAction } from '@/components/sponsors/pitch-state-action'
import { SponsorRow } from '@/components/sponsors/sponsor-summary'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Pagination } from '@/components/ui/table'
import { requireTeamMember } from '@/lib/server/authz'
import { listDirectory, teamPitchesBySponsor } from '@/lib/server/data/directory'
import { guardPage } from '@/lib/server/page-guards'
import { directoryState } from '@/lib/shared/pitch'
import { SUPPORT_TYPES, type SupportType } from '@/lib/shared/types'

import { DirectoryControls } from './directory-controls'

export const metadata: Metadata = { title: 'Sponsors' }

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

export default async function SponsorsPage({ searchParams }: PageProps<'/sponsors'>) {
  const [viewer, params] = await Promise.all([guardPage(() => requireTeamMember()), searchParams])
  const q = (one(params.q) ?? '').slice(0, 100)
  const typeParam = one(params.type)
  const type = SUPPORT_TYPES.includes(typeParam as SupportType) ? (typeParam as SupportType) : null
  const after = one(params.after) ?? null
  const before = one(params.before) ?? null

  const [page, statuses] = await Promise.all([listDirectory({ q, type, after, before }), teamPitchesBySponsor(viewer)])
  const filtered = Boolean(q || type)

  const hrefWith = (cursor: { after?: string; before?: string }) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (type) sp.set('type', type)
    if (cursor.after) sp.set('after', cursor.after)
    if (cursor.before) sp.set('before', cursor.before)
    return `/sponsors?${sp.toString()}`
  }

  return (
    <PageContainer>
      <PageHeader title="Sponsors" description="Companies on FTC Pitfund that want pitches from FTC teams. Each one asks its own questions." />
      <DirectoryControls q={q} type={type}>
        {page.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No companies match"
              description={q ? `Nothing matches “${q}”${type ? ' with that kind of support' : ''}. Try a shorter name or clear the filters.` : 'No company offers that kind of support yet.'}
              action={
                <Button asChild variant="secondary">
                  <Link href="/sponsors">Clear search</Link>
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
            {page.nextCursor || page.prevCursor ? (
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
