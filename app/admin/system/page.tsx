import { AlertTriangle, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { EmailActions } from '@/components/admin/email-actions'
import { Meter } from '@/components/ui/facts'
import { Banner, StatusBadge } from '@/components/ui/feedback'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireAdmin } from '@/lib/server/authz'
import { CRON_STALE_MS, getSystemStatus, type SystemEmail } from '@/lib/server/data/system'
import { budgetFor } from '@/lib/server/email/outbox'
import { guardPage } from '@/lib/server/page-guards'
import { cn } from '@/lib/shared/cn'
import { formatBytes, formatDateTime, formatRelative } from '@/lib/shared/format'
import { EMAIL_STATUS } from '@/lib/shared/labels'

export const metadata: Metadata = { title: 'System' }

const PRIORITY_LABEL: Record<number, string> = { 0: 'Sign-in codes', 1: 'Pitches and accounts', 2: 'Admin alerts', 3: 'Daily digest' }

const JOB_LABEL: Record<string, string> = {
  'drain-outbox': 'Send queued email',
  'admin-digest': 'Admin digest',
  'clean-staging': 'Clean abandoned uploads',
  'ftc-directory': 'Refresh FIRST team list',
  'recheck-records': 'Re-check FIRST records',
  keepalive: 'Database keepalive',
}

const LINKS = [
  { label: 'Supabase usage', href: 'https://supabase.com/dashboard/project/_/settings/billing/usage' },
  { label: 'Resend', href: 'https://resend.com/emails' },
]

export default async function AdminSystemPage() {
  await guardPage(() => requireAdmin())
  const now = new Date()
  const system = await getSystemStatus(now)
  const { email } = system
  const staleJobs = system.cron.filter((j) => j.stale)
  const failedJobs = system.cron.filter((j) => j.ok === false)

  return (
    <PageContainer width="review">
      <PageHeader
        title="System"
        description="Email, storage and the daily job, against the free-tier limits. Each limit says when it’s time to pay."
        actions={
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-body font-medium text-accent hover:text-accent-hover">
                {l.label}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        }
      />

      {staleJobs.length === system.cron.length ? (
        <Banner tone="warning" title="The daily job hasn’t run in over 36 hours" className="mb-8">
          Queued email only goes out after actions and in the daily job. Check the Vercel cron (0 13 * * *) and its logs.
        </Banner>
      ) : staleJobs.length || failedJobs.length ? (
        <Banner tone="warning" title="Some daily jobs need attention" className="mb-8">
          {[
            staleJobs.length ? `${staleJobs.map((j) => JOB_LABEL[j.job] ?? j.job).join(', ')} hasn’t run in over 36 hours.` : null,
            failedJobs.length ? `${failedJobs.map((j) => JOB_LABEL[j.job] ?? j.job).join(', ')} failed last time.` : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </Banner>
      ) : null}

      <div className="grid gap-12">
        <section aria-labelledby="usage-heading" className="grid gap-5">
          <SectionTitle id="usage-heading" title="Limits" />
          <div className="grid gap-px overflow-hidden rounded-dialog border border-border bg-border lg:grid-cols-3">
            <LimitCard
              meter={<Meter label="Emails in the last 24 h" used={email.used} limit={email.limit} display={`${email.used} / ${email.limit}`} warnAt={0.8} dangerAt={0.9} />}
              guidance="Upgrade to Resend Pro ($20/mo) when this is 80 or more most days."
            >
              <ul className="grid gap-1.5">
                {[0, 1, 2, 3].map((p) => (
                  <li key={p} className="flex items-baseline justify-between gap-3 text-small">
                    <span className="text-text-secondary">{PRIORITY_LABEL[p]}</span>
                    <span className="text-text tabular">
                      {email.byPriority[p] ?? 0} <span className="text-text-tertiary">· stops at {budgetFor(p)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </LimitCard>
            <LimitCard
              meter={<Meter label="File storage" used={system.storage.usedBytes} limit={system.storage.limitBytes} display={`${formatBytes(system.storage.usedBytes)} / 1 GB`} />}
              guidance="Move files to Cloudflare R2 or upgrade Supabase ($25/mo) when this passes 800 MB. Watch egress (5 GB/month) on the Supabase usage page."
            >
              <p className="text-small text-text-secondary tabular">{system.storage.files.toLocaleString()} decks, previews and logos</p>
            </LimitCard>
            <LimitCard
              meter={<Meter label="Database" used={system.database.usedBytes} limit={system.database.limitBytes} display={`${formatBytes(system.database.usedBytes)} / 500 MB`} />}
              guidance="Upgrade to Supabase Pro ($25/mo) when this passes 400 MB. Supabase free has no backups: run npm run db:backup."
            />
          </div>
        </section>

        <section aria-labelledby="cron-heading" className="grid gap-5">
          <SectionTitle id="cron-heading" title="Daily job" description="Runs once a day at 13:00 UTC. Each step is recorded separately." />
          <ul className="divide-y divide-border rounded-dialog border border-border bg-surface">
            {system.cron.map((job) => (
              <li key={job.job} className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
                <span className="flex min-w-0 items-center gap-2.5">
                  {job.ok === false ? (
                    <XCircle aria-hidden="true" className="size-4 shrink-0 text-danger" />
                  ) : job.stale ? (
                    <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-warning" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
                  )}
                  <span className="text-body font-medium text-text">{JOB_LABEL[job.job] ?? job.job}</span>
                </span>
                <span className="grid min-w-0 gap-0.5 pl-[26px] text-small sm:pl-0 sm:text-right">
                  <span className={cn(job.stale ? 'text-warning' : 'text-text-secondary')}>
                    {job.startedAt ? `${job.ok === false ? 'Failed' : job.ok === null ? 'Started' : 'Ran'} ${formatRelative(job.startedAt, now)}` : 'Never ran'}
                    {job.stale && job.startedAt ? ` · over ${Math.round(CRON_STALE_MS / 3_600_000)} h ago` : ''}
                  </span>
                  <span className="min-w-0 text-text-tertiary line-clamp-2 user-text">{describeJob(job.detail)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="queued-heading" className="grid gap-5">
          <SectionTitle
            id="queued-heading"
            title={`Queued email (${email.queued})`}
            description={email.used >= budgetFor(1) ? 'Email delivery is delayed until the 24-hour window frees up. Sign-in codes still go out.' : 'Waiting to send, or retrying after a provider error.'}
          />
          <EmailList rows={system.queued} kind="queued" now={now} empty="Nothing is waiting to send." />
        </section>

        <section aria-labelledby="problems-heading" className="grid gap-5">
          <SectionTitle id="problems-heading" title={`Failed and bounced (${email.problems})`} description="The in-app notification still reached these people; only the email copy is missing." />
          <EmailList rows={system.problems} kind="problem" now={now} empty="No failed or bounced email." />
        </section>
      </div>
    </PageContainer>
  )
}

function describeJob(detail: Record<string, unknown>): string {
  if (typeof detail.error === 'string') return detail.error
  const result = detail.result as Record<string, unknown> | number | null | undefined
  if (result === null || result === undefined) return ''
  if (typeof result !== 'object') return ''
  if (result.skipped === true && typeof result.reason === 'string') return result.reason
  return Object.entries(result)
    .filter(([k, v]) => typeof v === 'number' && k !== 'rounds' && k !== 'admins')
    .map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`)
    .join(' · ')
}

function SectionTitle({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div className="grid gap-0.5">
      <h2 id={id} className="text-lead font-semibold tracking-tight text-text">
        {title}
      </h2>
      {description ? <p className="text-body text-text-secondary">{description}</p> : null}
    </div>
  )
}

function LimitCard({ meter, guidance, children }: { meter: ReactNode; guidance: string; children?: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-4 bg-surface p-5">
      {meter}
      {children}
      <p className="mt-auto border-t border-border pt-3 text-small text-text-tertiary">{guidance}</p>
    </div>
  )
}

function EmailList({ rows, kind, now, empty }: { rows: SystemEmail[]; kind: 'queued' | 'problem'; now: Date; empty: string }) {
  if (rows.length === 0) return <p className="rounded-dialog border border-border bg-surface px-5 py-8 text-center text-body text-text-tertiary">{empty}</p>
  return (
    <ul className="divide-y divide-border rounded-dialog border border-border bg-surface">
      {rows.map((row) => {
        const status = EMAIL_STATUS[row.status]
        const waiting = row.sendAfter.getTime() > now.getTime()
        return (
          <li key={row.id} className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-5">
            <div className="grid min-w-0 gap-0.5">
              <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 text-body font-medium text-text line-clamp-1 user-text">{row.to}</span>
                <StatusBadge label={status.label} tone={status.tone} />
                <span className="text-small text-text-tertiary">{row.template} · {PRIORITY_LABEL[row.priority] ?? `priority ${row.priority}`}</span>
              </p>
              <p className="text-small text-text-secondary">
                {kind === 'queued'
                  ? waiting
                    ? `Sends after ${formatDateTime(row.sendAfter)}`
                    : 'Due now'
                  : `${row.status === 'bounced' ? 'Bounced' : 'Failed'} ${formatRelative(row.updatedAt, now)}`}
                {row.attempts ? ` · ${row.attempts} ${row.attempts === 1 ? 'attempt' : 'attempts'}` : ''}
              </p>
              {row.lastError ? <p className="min-w-0 text-small text-text-tertiary line-clamp-2 user-text">{row.lastError}</p> : null}
            </div>
            <div className="flex sm:justify-end">{kind === 'problem' || row.canSendNow ? <EmailActions id={row.id} kind={kind} /> : null}</div>
          </li>
        )
      })}
    </ul>
  )
}
