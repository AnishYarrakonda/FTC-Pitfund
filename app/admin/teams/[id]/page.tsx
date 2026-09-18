import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { DeleteOrgDialog, RecheckRecordButton, TeamDecisions } from '@/components/admin/org-actions'
import { Facts } from '@/components/ui/facts'
import { EmptyState, StatusBadge } from '@/components/ui/feedback'
import { Avatar, OrgLogo, VerifiedCheck } from '@/components/ui/identity'
import { PageContainer } from '@/components/ui/page'
import { requireAdmin } from '@/lib/server/authz'
import { getTeamForAdmin } from '@/lib/server/data/admin-orgs'
import { guardPage } from '@/lib/server/page-guards'
import { AppError } from '@/lib/server/result'
import { formatBytes, formatDate, formatRelative } from '@/lib/shared/format'
import { ORG_STATUS, PITCH_STATUS } from '@/lib/shared/labels'
import { placeLabel } from '@/lib/shared/team'
import { displayWebsite } from '@/lib/shared/url'

export const metadata: Metadata = { title: 'Team review' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RECORD = { matched: 'Found in FIRST records', manual: 'Not found in FIRST records', unchecked: 'Not checked yet' } as const

/** Team review (prompt 3, scope D): verify, suspend, re-check FIRST records. A page, per plan §7. */
export default async function AdminTeamPage({ params }: PageProps<'/admin/teams/[id]'>) {
  const [admin, { id }] = await Promise.all([guardPage(() => requireAdmin()), params])
  if (!UUID.test(id)) notFound()
  const team = await getTeamForAdmin(admin, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound()
    throw e
  })
  const place = placeLabel(team)

  return (
    <PageContainer width="review">
      <Link href={team.status === 'pending' ? '/admin?tab=teams' : '/admin/directory'} className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {team.status === 'pending' ? 'Teams to review' : 'Directory'}
      </Link>

      <header className="mt-6 flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <OrgLogo name={team.name} src={team.logoUrl} size="lg" />
          <div className="grid min-w-0 gap-1.5">
            <h1 className="min-w-0 text-h2 font-semibold tracking-tighter text-text user-text">
              Team {team.number} · {team.name}
              {team.status === 'approved' ? <VerifiedCheck className="ml-2 align-[-1px]" /> : null}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-secondary">
              {team.suspendedAt ? <StatusBadge label="Suspended" tone="danger" /> : <StatusBadge label={ORG_STATUS[team.status].label} tone={ORG_STATUS[team.status].tone} />}
              {place ? <span className="min-w-0 line-clamp-1 user-text">{place}</span> : null}
              <span className="text-text-tertiary">Joined {formatDate(team.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <TeamDecisions teamId={team.id} number={team.number} status={team.status} suspended={Boolean(team.suspendedAt)} />
        </div>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="grid min-w-0 content-start gap-8">
          <section aria-labelledby="record-heading" className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="record-heading" className="text-lead font-semibold tracking-tight text-text">
                FIRST record
              </h2>
              <RecheckRecordButton teamId={team.id} />
            </div>
            <div className="rounded-dialog border border-border bg-surface p-5">
              <Facts
                rows={[
                  { label: 'Status', value: <StatusBadge label={RECORD[team.recordStatus]} tone={team.recordStatus === 'matched' ? 'success' : team.recordStatus === 'manual' ? 'warning' : 'neutral'} /> },
                  { label: 'Name on record', value: team.record?.name ?? <span className="text-text-tertiary">No record cached</span> },
                  team.record ? { label: 'Location on record', value: [team.record.city, team.record.state].filter(Boolean).join(', ') || '—' } : null,
                  team.record ? { label: 'Checked', value: `${formatRelative(team.record.fetchedAt)} via ${team.record.source === 'first' ? 'FIRST' : 'FTCScout'}` } : null,
                  { label: 'Name on FTC Pitfund', value: team.name },
                  { label: 'Location on FTC Pitfund', value: place || '—' },
                ]}
              />
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-4 text-small">
                <ExternalLink href={`https://ftcscout.org/teams/${team.number}`}>FTCScout</ExternalLink>
                <ExternalLink href={`/t/${team.number}`}>Public page</ExternalLink>
                {team.website ? <ExternalLink href={team.website}>{displayWebsite(team.website)}</ExternalLink> : null}
              </div>
            </div>
          </section>

          <section aria-labelledby="profile-heading" className="grid gap-4">
            <h2 id="profile-heading" className="text-lead font-semibold tracking-tight text-text">
              Profile
            </h2>
            <div className="rounded-dialog border border-border bg-surface p-5">
              <Facts
                rows={[
                  { label: 'One-line summary', value: team.summary ?? <span className="text-text-tertiary">None yet</span> },
                  { label: 'Deck', value: team.deck ? <ExternalLink href={team.deck.url}>{`${team.deck.pages} ${team.deck.pages === 1 ? 'page' : 'pages'}${team.deck.bytes ? ` · ${formatBytes(team.deck.bytes)}` : ''}`}</ExternalLink> : <span className="text-text-tertiary">None yet</span> },
                  { label: 'Open reports', value: team.openReports ? <Link href="/admin?tab=reports" className="font-medium text-warning hover:underline">{team.openReports}</Link> : '0' },
                ]}
              />
            </div>
          </section>

          <section aria-labelledby="proof-heading" className="grid gap-4">
            <h2 id="proof-heading" className="text-lead font-semibold tracking-tight text-text">
              Proof they coach this team
            </h2>
            <div className="rounded-dialog border border-border bg-surface p-5">
              {team.proofUrl ? (
                <div className="grid gap-3">
                  <p className="text-small text-text-secondary">
                    Their FIRST Dashboard, showing their own name on the roster. Check the name against the coaches listed below.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private signed URL the optimizer can't fetch */}
                  <img
                    src={team.proofUrl}
                    alt={`Verification screenshot for Team ${team.number}`}
                    className="w-full rounded-control border border-border bg-canvas"
                    loading="lazy"
                    decoding="async"
                  />
                  <p className="text-small text-text-tertiary">
                    Uploaded {team.proofUploadedAt ? formatDate(team.proofUploadedAt) : 'at an unknown time'}. This link expires in 15 minutes.
                  </p>
                </div>
              ) : (
                <p className="text-body text-text-tertiary">
                  {team.status === 'approved'
                    ? 'Deleted when this team was approved — it is only kept while a decision is pending.'
                    : 'No screenshot uploaded yet.'}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="pitches-heading" className="grid gap-4">
            <h2 id="pitches-heading" className="text-lead font-semibold tracking-tight text-text">
              Pitches
            </h2>
            {team.pitches.length === 0 ? (
              <EmptyState title="No pitches yet" description="Drafts aren’t shown here." className="rounded-dialog border border-border bg-surface py-10" />
            ) : (
              <ul className="divide-y divide-border rounded-dialog border border-border bg-surface">
                {team.pitches.map((p) => (
                  <li key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                    <Link href={`/admin/pitches/${p.id}`} className="min-w-0 text-body font-medium text-text line-clamp-1 hover:underline">
                      {p.companyName}
                    </Link>
                    <span className="flex items-center gap-3">
                      <StatusBadge label={PITCH_STATUS[p.status].label} tone={PITCH_STATUS[p.status].tone} />
                      <span className="text-small text-text-tertiary">{formatRelative(p.updatedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="grid min-w-0 content-start gap-6" aria-label="Members">
          <section className="grid gap-4 rounded-dialog border border-border bg-surface p-5" aria-label="Coaches">
            <h2 className="text-body font-semibold text-text">Coaches ({team.members.length})</h2>
            {team.members.length ? (
              <ul className="grid gap-3">
                {team.members.map((m) => (
                  <li key={m.userId} className="flex min-w-0 items-center gap-3">
                    <Avatar name={m.name} size="sm" />
                    <span className="grid min-w-0">
                      <span className="text-small font-medium text-text line-clamp-1">{m.name}</span>
                      <a href={`mailto:${m.email}`} className="text-small text-text-tertiary line-clamp-1 hover:text-text">
                        {m.email}
                      </a>
                      {m.phone ? <span className="text-small text-text-tertiary">{m.phone}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-text-tertiary">No coaches left on this team.</p>
            )}
            {team.decidedAt ? (
              <p className="border-t border-border pt-3 text-small text-text-tertiary">
                {team.status === 'approved' ? 'Approved' : team.status === 'rejected' ? 'Rejected' : 'Decided'} by {team.decidedByName ?? 'an admin'} on{' '}
                {formatDate(team.decidedAt)}
              </p>
            ) : null}
          </section>
          <div>
            <DeleteOrgDialog kind="team" id={team.id} name={team.name} consequence="The team, its public page, deck, members’ access and every pitch it sent are deleted. This can’t be undone." />
          </div>
        </aside>
      </div>
    </PageContainer>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium text-accent hover:text-accent-hover">
      <span className="min-w-0 line-clamp-1">{children}</span>
      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
    </a>
  )
}
