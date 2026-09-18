import { CheckCircle2, Circle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { EmptyState, StatusBadge } from '@/components/ui/feedback'
import { OrgLogo } from '@/components/ui/identity'
import { LinkPendingIndicator } from '@/components/ui/link-status'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireApprovedTeam } from '@/lib/server/authz'
import { EVENT_VERBS, listTeamPitches, type TeamPitchRow } from '@/lib/server/data/pitches'
import { getTeamSetup } from '@/lib/server/data/teams'
import { guardPage } from '@/lib/server/page-guards'
import { cn } from '@/lib/shared/cn'
import { formatRelative } from '@/lib/shared/format'
import { PITCH_STATUS } from '@/lib/shared/labels'
import { nextStep, PITCH_GROUPS } from '@/lib/shared/pitch'
import { setupChecklist } from '@/lib/shared/team'

export const metadata: Metadata = { title: 'Pitches' }

// The guard redirects an org that isn't approved yet, so this route can't be validated as instant —
// the same reason the workspace layout opts out.
export const instant = false

export default async function PitchesPage() {
  const viewer = await guardPage(() => requireApprovedTeam())
  const [rows, setup] = await Promise.all([listTeamPitches(viewer), getTeamSetup(viewer)])
  const checklist = setupChecklist(setup)
  const groups = PITCH_GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => g.statuses.includes(r.status)) })).filter((g) => g.rows.length > 0)

  return (
    <PageContainer>
      <PageHeader
        title="Pitches"
        description="Every pitch your team starts, and where each one stands."
        actions={
          <Button asChild>
            <Link href="/sponsors">Browse sponsors</Link>
          </Button>
        }
      />

      {!checklist.complete ? (
        <section aria-labelledby="setup-heading" className="mb-10 grid gap-4 rounded-dialog border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="grid gap-1">
              <h2 id="setup-heading" className="text-lead font-semibold tracking-tight text-text">
                Finish setting up your team
              </h2>
              <p className="text-body text-text-secondary">Companies see your deck and summary with every pitch. You can draft pitches in the meantime.</p>
            </div>
            <p className="text-small text-text-tertiary tabular">
              {checklist.done} of {checklist.total} done
            </p>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={checklist.total} aria-valuenow={checklist.done}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${(checklist.done / checklist.total) * 100}%` }} />
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {checklist.items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-control px-2 py-2 text-body transition-colors duration-120 hover:bg-muted',
                    item.done ? 'text-text-tertiary' : 'text-text',
                  )}
                >
                  {item.done ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" /> : <Circle aria-hidden="true" className="size-4 shrink-0 text-border-strong" />}
                  <span className={cn(item.done && 'line-through decoration-border-strong')}>{item.label}</span>
                  {item.optional ? <span className="text-small text-text-tertiary">Optional</span> : null}
                  <span className="sr-only">{item.done ? '(done)' : '(to do)'}</span>
                  <LinkPendingIndicator className="ml-auto" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="No pitches yet"
          description="Pick a company in the sponsor directory and answer its questions. A reviewer reads every pitch before the company sees it."
          action={
            <Button asChild>
              <Link href="/sponsors">Browse sponsors</Link>
            </Button>
          }
          className="rounded-dialog border border-border bg-surface"
        />
      ) : (
        <div className="grid gap-10">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`} className="grid gap-3">
              <h2 id={`group-${group.key}`} className="flex items-baseline gap-2 text-body font-semibold text-text">
                {group.title}
                <span className="text-small font-normal text-text-tertiary tabular">{group.rows.length}</span>
              </h2>
              <ul className="divide-y divide-border rounded-dialog border border-border bg-surface">
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <PitchRow row={row} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function PitchRow({ row }: { row: TeamPitchRow }) {
  const status = PITCH_STATUS[row.status]
  const verb = (row.lastAction && EVENT_VERBS[row.lastAction]) || 'Updated'
  return (
    <Link href={`/pitches/${row.id}`} className="group flex min-w-0 items-start gap-4 px-4 py-4 transition-colors duration-120 hover:bg-canvas sm:items-center sm:px-5">
      <OrgLogo name={row.companyName} src={row.companyLogoUrl} size="md" />
      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
        <div className="grid min-w-0 gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-body font-semibold text-text">
            <span className="min-w-0 line-clamp-1 user-text">{row.companyName}</span>
            <LinkPendingIndicator />
          </span>
          <span className="min-w-0 text-small text-text-secondary">{nextStep(row.status, row.companyName)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end sm:gap-1">
          <StatusBadge label={status.label} tone={status.tone} />
          <span className="text-small text-text-tertiary">
            {verb} {formatRelative(row.lastAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}
