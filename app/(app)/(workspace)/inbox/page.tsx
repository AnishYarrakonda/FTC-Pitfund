import type { Metadata } from 'next'
import Link from 'next/link'

import { CompanyChecklist, CompanyStatusBanner } from '@/components/company/company-status'
import { InboxRow } from '@/components/inbox/inbox-row'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireApprovedSponsor } from '@/lib/server/authz'
import { getCompanyProfile } from '@/lib/server/data/company'
import { listInbox, type InboxGroups } from '@/lib/server/data/inbox'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'Pitches' }

// The guard redirects a company that isn't approved yet, so this route can't be validated as
// instant — the same reason the workspace layout opts out.
export const instant = false

const GROUPS: Array<{ key: keyof InboxGroups; title: string; description: string }> = [
  { key: 'sent', title: 'New', description: 'Waiting for your answer.' },
  { key: 'matched', title: 'Interested', description: 'You’re connected. Contact details are on each pitch.' },
  { key: 'declined', title: 'Not a fit', description: 'The team was told.' },
]

export default async function InboxPage() {
  const viewer = await guardPage(() => requireApprovedSponsor())
  const [profile, inbox] = await Promise.all([getCompanyProfile(viewer), listInbox(viewer)])
  const approved = profile.status === 'approved'
  const total = inbox.sent.length + inbox.matched.length + inbox.declined.length

  return (
    <PageContainer>
      <PageHeader
        title="Pitches"
        description={`Pitches from FTC teams to ${profile.name}. A reviewer reads every one before it reaches you.`}
        actions={
          approved && total > 0 ? (
            <Button asChild variant="secondary">
              <Link href="/company">Company profile</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 empty:hidden">
        <CompanyStatusBanner status={profile.status} name={profile.name} note={profile.statusNote} />
        {profile.status !== 'rejected' ? <CompanyChecklist profile={profile} /> : null}
      </div>

      <div className="mt-8 grid gap-10">
        {!approved ? (
          <EmptyState
            title={profile.status === 'pending' ? 'You’ll see pitches here once approved' : 'No pitches'}
            description={
              profile.status === 'pending'
                ? 'Each pitch answers your questions and includes the team’s deck. Set up your profile while you wait.'
                : 'Teams can’t pitch your company right now.'
            }
            action={
              profile.status === 'pending' ? (
                <Button asChild>
                  <Link href="/company">Set up your profile</Link>
                </Button>
              ) : null
            }
            className="rounded-dialog border border-border bg-surface"
          />
        ) : total === 0 ? (
          <EmptyState
            title="No pitches yet"
            description={`Teams can now find ${profile.name} in the directory. We’ll email everyone at your company when a pitch arrives.`}
            action={
              <Button asChild variant="secondary">
                <Link href="/company">Review your profile</Link>
              </Button>
            }
            className="rounded-dialog border border-border bg-surface"
          />
        ) : (
          GROUPS.filter((g) => inbox[g.key].length > 0).map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`} className="grid gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`group-${group.key}`} className="text-lead font-semibold tracking-tight text-text">
                  {group.title} <span className="text-text-tertiary tabular">{inbox[group.key].length}</span>
                </h2>
                <p className="text-small text-text-tertiary">{group.description}</p>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-dialog border border-border bg-surface">
                {inbox[group.key].map((pitch) => (
                  <li key={pitch.id}>
                    <InboxRow pitch={pitch} href={`/inbox/${pitch.id}`} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </PageContainer>
  )
}
