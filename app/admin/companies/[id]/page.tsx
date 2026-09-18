import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { CompanyDecisions, DeleteOrgDialog } from '@/components/admin/org-actions'
import { SponsorProfile } from '@/components/sponsors/sponsor-profile'
import { Facts } from '@/components/ui/facts'
import { Banner, StatusBadge } from '@/components/ui/feedback'
import { Avatar } from '@/components/ui/avatar'
import { PageContainer } from '@/components/ui/page'
import { requireAdmin } from '@/lib/server/authz'
import { getCompanyForAdmin } from '@/lib/server/data/admin-orgs'
import { guardPage } from '@/lib/server/page-guards'
import { AppError } from '@/lib/server/result'
import { formatDate } from '@/lib/shared/format'
import { ORG_STATUS } from '@/lib/shared/labels'
import { displayWebsite } from '@/lib/shared/url'

export const metadata: Metadata = { title: 'Company review' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Company review (prompt 3, scope D). The plan makes review screens pages, not panels (§7), so the
 * Companies tab and the directory link here: the applicant, what to check, the profile so far.
 */
export default async function AdminCompanyPage({ params }: PageProps<'/admin/companies/[id]'>) {
  const [admin, { id }] = await Promise.all([guardPage(() => requireAdmin()), params])
  if (!UUID.test(id)) notFound()
  const company = await getCompanyForAdmin(admin, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound()
    throw e
  })
  const status = ORG_STATUS[company.status]
  const received = (company.pitchCounts.sent ?? 0) + (company.pitchCounts.matched ?? 0) + (company.pitchCounts.declined ?? 0)

  return (
    <PageContainer width="review">
      <Link href={company.status === 'pending' ? '/admin?tab=companies' : '/admin/directory?tab=companies'} className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {company.status === 'pending' ? 'Companies to approve' : 'Directory'}
      </Link>

      <header className="mt-6 flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="grid min-w-0 gap-2">
          <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">{company.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-secondary">
            <StatusBadge label={status.label} tone={status.tone} />
            <span>Applied {formatDate(company.createdAt)}</span>
            {company.decidedAt && company.status !== 'pending' ? (
              <span className="text-text-tertiary">
                {status.label} by {company.decidedByName ?? 'an admin'} on {formatDate(company.decidedAt)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="shrink-0">
          <CompanyDecisions sponsorId={company.id} name={company.name} status={company.status} />
        </div>
      </header>

      {company.status === 'rejected' && company.statusNote ? (
        <Banner tone="danger" title="Rejection note sent to the company" className="mt-6">
          <span className="line-clamp-6 user-text-block">{company.statusNote}</span>
        </Banner>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-12">
        <aside className="grid min-w-0 content-start gap-6" aria-label="Applicant and facts">
          <Card title="Applicant">
            {company.applicant ? (
              <Facts
                rows={[
                  { label: 'Name', value: company.applicant.name },
                  { label: 'Job title', value: <span className="line-clamp-3">{company.applicant.jobTitle ?? 'Not given'}</span> },
                  {
                    label: 'Email',
                    value: (
                      <a href={`mailto:${company.applicant.email}`} className="text-accent hover:text-accent-hover">
                        {company.applicant.email}
                      </a>
                    ),
                  },
                  { label: 'LinkedIn', value: company.applicant.linkedin ? <ExternalLink href={company.applicant.linkedin}>{displayWebsite(company.applicant.linkedin)}</ExternalLink> : <span className="text-text-tertiary">Not given</span> },
                ]}
              />
            ) : (
              <p className="text-body text-text-tertiary">No members left.</p>
            )}
          </Card>
          <Card title="What to check">
            <Facts
              rows={[
                { label: 'Website', value: <ExternalLink href={company.website}>{displayWebsite(company.website)}</ExternalLink> },
                { label: 'Email domain', value: company.applicant ? company.applicant.email.split('@')[1] : '—' },
                { label: 'Pitches received', value: received },
              ]}
            />
          </Card>
          <Card title={`Members (${company.members.length})`}>
            <ul className="grid gap-3">
              {company.members.map((m) => (
                <li key={m.userId} className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.name} size="sm" />
                  <span className="grid min-w-0">
                    <span className="text-small font-medium text-text line-clamp-1">{m.name}</span>
                    <span className="text-small text-text-tertiary line-clamp-1">{m.email}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <div>
            <DeleteOrgDialog kind="company" id={company.id} name={company.name} consequence="The company, its members’ access, invites and every pitch sent to it are deleted. This can’t be undone." />
          </div>
        </aside>

        <section aria-labelledby="profile-heading" className="min-w-0">
          <h2 id="profile-heading" className="mb-6 text-small font-medium text-text-tertiary">
            The profile so far, as teams would see it
          </h2>
          <div className="rounded-dialog border border-border bg-surface p-5 sm:p-8">
            <SponsorProfile sponsor={company} preview />
          </div>
        </section>
      </div>
    </PageContainer>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4 rounded-dialog border border-border bg-surface p-5" aria-label={title}>
      <h2 className="text-body font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1 font-medium text-accent hover:text-accent-hover">
      <span className="min-w-0 line-clamp-1">{children}</span>
      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
    </a>
  )
}
