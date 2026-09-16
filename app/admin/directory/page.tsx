import type { Metadata } from 'next'
import Link from 'next/link'

import { DirectorySearch } from '@/components/admin/directory-search'
import { PersonActions } from '@/components/admin/person-actions'
import { Button } from '@/components/ui/button'
import { EmptyState, StatusBadge } from '@/components/ui/feedback'
import { Avatar, OrgLogo, TeamMark } from '@/components/ui/identity'
import { LinkTabs } from '@/components/ui/link-tabs'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { DataTable, Pagination } from '@/components/ui/table'
import { requireAdmin } from '@/lib/server/authz'
import { searchCompanies, searchPeople, searchTeams } from '@/lib/server/data/admin-directory'
import { guardPage } from '@/lib/server/page-guards'
import { formatDate, pluralize } from '@/lib/shared/format'
import { ORG_STATUS } from '@/lib/shared/labels'
import { placeLabel } from '@/lib/shared/team'
import { displayWebsite } from '@/lib/shared/url'

export const metadata: Metadata = { title: 'Directory' }

const TABS = ['teams', 'companies', 'people'] as const
type Tab = (typeof TABS)[number]

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)

export default async function AdminDirectoryPage({ searchParams }: PageProps<'/admin/directory'>) {
  const [admin, params] = await Promise.all([guardPage(() => requireAdmin()), searchParams])
  const tab: Tab = TABS.includes(one(params.tab) as Tab) ? (one(params.tab) as Tab) : 'teams'
  const q = (one(params.q) ?? '').slice(0, 100)
  const page = { after: one(params.after) ?? null, before: one(params.before) ?? null }

  const hrefFor = (t: Tab, extra: { q?: string; after?: string; before?: string } = {}) => {
    const sp = new URLSearchParams()
    if (t !== 'teams') sp.set('tab', t)
    if (extra.q) sp.set('q', extra.q)
    if (extra.after) sp.set('after', extra.after)
    if (extra.before) sp.set('before', extra.before)
    const query = sp.toString()
    return query ? `/admin/directory?${query}` : '/admin/directory'
  }

  const empty = (what: string) => (
    <EmptyState
      title={q ? `No ${what} match “${q}”` : `No ${what} yet`}
      description={q ? 'Try part of a name, a team number or an email address.' : `${what[0].toUpperCase()}${what.slice(1)} appear here as they sign up.`}
      action={
        q ? (
          <Button asChild variant="secondary">
            <Link href={hrefFor(tab)}>Clear search</Link>
          </Button>
        ) : null
      }
      className="rounded-dialog border border-border bg-surface"
    />
  )

  let body: React.ReactNode
  let cursors: { nextCursor: string | null; prevCursor: string | null; count: number }

  if (tab === 'teams') {
    const result = await searchTeams(q, page)
    cursors = { ...result, count: result.items.length }
    body = (
      <DataTable
        caption="Teams"
        rows={result.items}
        rowKey={(t) => t.id}
        empty={empty('teams')}
        columns={[
          {
            key: 'team',
            header: 'Team',
            className: 'w-[42%]',
            cell: (t) => (
              <Link href={`/admin/teams/${t.id}`} className="block min-w-0 rounded-control hover:underline hover:decoration-border-strong hover:underline-offset-4">
                <TeamMark name={t.name} number={t.number} logoSrc={t.logoUrl} verified={t.verified} meta={placeLabel(t) || null} size="sm" />
              </Link>
            ),
          },
          { key: 'status', header: 'Status', cell: (t) => (t.suspended ? <StatusBadge label="Suspended" tone="danger" /> : t.verified ? <StatusBadge label="Verified" tone="success" /> : <StatusBadge label="Not verified" tone="warning" />) },
          { key: 'members', header: 'Coaches', align: 'right', cell: (t) => <span className="tabular">{t.members}</span> },
          { key: 'pitches', header: 'Pitches', align: 'right', cell: (t) => <span className="tabular">{t.pitches}</span> },
          { key: 'joined', header: 'Joined', align: 'right', cell: (t) => <span className="text-text-secondary">{formatDate(t.createdAt)}</span> },
        ]}
      />
    )
  } else if (tab === 'companies') {
    const result = await searchCompanies(q, page)
    cursors = { ...result, count: result.items.length }
    body = (
      <DataTable
        caption="Companies"
        rows={result.items}
        rowKey={(c) => c.id}
        empty={empty('companies')}
        columns={[
          {
            key: 'company',
            header: 'Company',
            className: 'w-[42%]',
            cell: (c) => (
              <Link href={`/admin/companies/${c.id}`} className="flex min-w-0 items-center gap-3 rounded-control hover:underline hover:decoration-border-strong hover:underline-offset-4">
                <OrgLogo name={c.name} src={c.logoUrl} size="sm" />
                <span className="grid min-w-0">
                  <span className="text-small font-medium text-text user-text">{c.name}</span>
                  <span className="text-small text-text-tertiary line-clamp-1 user-text">{displayWebsite(c.website)}</span>
                </span>
              </Link>
            ),
          },
          { key: 'status', header: 'Status', cell: (c) => <StatusBadge label={ORG_STATUS[c.status].label} tone={ORG_STATUS[c.status].tone} /> },
          { key: 'members', header: 'Members', align: 'right', cell: (c) => <span className="tabular">{c.members}</span> },
          { key: 'pitches', header: 'Pitches', align: 'right', cell: (c) => <span className="tabular">{c.pitches}</span> },
          { key: 'joined', header: 'Joined', align: 'right', cell: (c) => <span className="text-text-secondary">{formatDate(c.createdAt)}</span> },
        ]}
      />
    )
  } else {
    const result = await searchPeople(q, page)
    cursors = { ...result, count: result.items.length }
    body = (
      <DataTable
        caption="People"
        rows={result.items}
        rowKey={(p) => p.id}
        empty={empty('people')}
        columns={[
          {
            key: 'person',
            header: 'Person',
            className: 'w-[34%]',
            cell: (p) => (
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                <span className="grid min-w-0">
                  <span className="text-small font-medium text-text line-clamp-1 user-text">{p.name}</span>
                  <span className="text-small text-text-tertiary line-clamp-2 break-all">{p.email}</span>
                </span>
              </span>
            ),
          },
          {
            key: 'org',
            header: 'Team or company',
            className: 'w-[30%]',
            cell: (p) =>
              p.org ? (
                <Link href={p.org.kind === 'team' ? `/admin/teams/${p.org.id}` : `/admin/companies/${p.org.id}`} className="block min-w-0 text-small text-text line-clamp-1 hover:underline">
                  {p.org.label}
                </Link>
              ) : (
                <span className="text-small text-text-tertiary">None</span>
              ),
          },
          {
            key: 'role',
            header: 'Access',
            cell: (p) => (
              <span className="flex flex-wrap justify-end gap-x-3 gap-y-1 sm:justify-start">
                {p.suspended ? <StatusBadge label="Suspended" tone="danger" /> : null}
                {p.isAdmin ? <StatusBadge label="Admin" tone="accent" /> : null}
                {!p.suspended && !p.isAdmin ? <span className="text-small text-text-tertiary">Member</span> : null}
              </span>
            ),
          },
          { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', className: 'w-16', cell: (p) => <PersonActions person={p} isSelf={p.id === admin.id} /> },
        ]}
      />
    )
  }

  return (
    <PageContainer width="review">
      <PageHeader title="Directory" description="Every team, company and person on FTC Pitfund. Open a team or company to review it." />
      <LinkTabs
        label="Directory"
        active={tab}
        className="mb-6"
        tabs={[
          { key: 'teams', label: 'Teams', href: hrefFor('teams') },
          { key: 'companies', label: 'Companies', href: hrefFor('companies') },
          { key: 'people', label: 'People', href: hrefFor('people') },
        ]}
      />
      <DirectorySearch
        q={q}
        tab={tab}
        label={tab === 'teams' ? 'Search teams by name or number' : tab === 'companies' ? 'Search companies by name or website' : 'Search people by name or email'}
        placeholder={tab === 'teams' ? 'Name or team number' : tab === 'companies' ? 'Name or website' : 'Name or email'}
      >
        {body}
        {cursors.nextCursor || cursors.prevCursor ? (
          <Pagination
            previousHref={cursors.prevCursor ? hrefFor(tab, { q, before: cursors.prevCursor }) : null}
            nextHref={cursors.nextCursor ? hrefFor(tab, { q, after: cursors.nextCursor }) : null}
            summary={`${pluralize(cursors.count, tab === 'people' ? 'person' : tab === 'teams' ? 'team' : 'company', tab === 'people' ? 'people' : tab === 'teams' ? 'teams' : 'companies')} on this page`}
          />
        ) : null}
      </DirectorySearch>
    </PageContainer>
  )
}
