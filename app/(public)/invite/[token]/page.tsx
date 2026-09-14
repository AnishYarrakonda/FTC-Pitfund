import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'

import { PublicFooter } from '@/components/app/public-chrome'
import { Wordmark } from '@/components/app/wordmark'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { OrgLogo } from '@/components/ui/identity'
import { getInviteByToken } from '@/lib/server/data/invites'
import { getViewer } from '@/lib/server/viewer'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { formatDate } from '@/lib/shared/format'
import { homeFor } from '@/lib/shared/viewer'

import { AcceptInvite, SignOutForInvite } from './invite-actions'

export const metadata: Metadata = { title: 'Invitation', robots: { index: false } }

/*
 * /invite/[token], generic for team and company invites (prompt 3 reuses it). States: invalid,
 * expired, revoked, already used, signed out, signed in with a different email, already in an org,
 * ready to accept. Accepting sends the person to their new org's home.
 */
export default function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="flex flex-1 flex-col items-center px-4 pt-16 pb-16 sm:pt-24">
        <div className="w-full max-w-form">
          <Wordmark className="mb-10" />
          <Suspense fallback={<InviteSkeleton />}>
            <InviteState params={params} />
          </Suspense>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

async function InviteState({ params }: Pick<PageProps<'/invite/[token]'>, 'params'>) {
  const { token } = await params
  const [invite, viewer] = await Promise.all([getInviteByToken(decodeURIComponent(token)), getViewer()])

  if (!invite) {
    return (
      <Message title="This invite link isn’t valid" action={<HomeLink signedIn={Boolean(viewer)} />}>
        Check that you opened the whole link from the email. If it still doesn’t work, ask for a new invite.
      </Message>
    )
  }

  const orgLabel = invite.kind === 'team' ? `Team ${invite.org.number} · ${invite.org.name}` : invite.org.name
  const header = (
    <div className="mb-8 flex min-w-0 items-center gap-3">
      <OrgLogo name={invite.org.name} src={invite.org.logoUrl} size="md" />
      <p className="min-w-0 text-body font-medium text-text user-text">{orgLabel}</p>
    </div>
  )

  if (invite.state !== 'valid') {
    const copy = {
      expired: { title: 'This invite has expired', body: `Invites work for 14 days. Ask someone on ${orgLabel} to send a new one.` },
      revoked: { title: 'This invite was cancelled', body: `Someone on ${orgLabel} cancelled it. Ask them for a new invite if you still need to join.` },
      used: { title: 'This invite was already used', body: 'Each invite works once. If you accepted it, sign in to continue.' },
    }[invite.state]
    return (
      <>
        {header}
        <Message title={copy.title} action={<HomeLink signedIn={Boolean(viewer)} />}>
          {copy.body}
        </Message>
      </>
    )
  }

  const who = invite.invitedByName ? `${invite.invitedByName} invited you` : 'You’re invited'
  const intro =
    invite.kind === 'team'
      ? 'Teams on FTC Pitfund share one account: every coach can edit the profile, upload the deck and pitch companies.'
      : 'Companies on FTC Pitfund share one account: every member can edit the profile and answer pitches.'
  const nextPath = `/invite/${token}`

  if (!viewer) {
    return (
      <>
        {header}
        <Message
          title={`Join ${orgLabel}`}
          action={
            <Button asChild size="lg">
              <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Sign in to accept</Link>
            </Button>
          }
        >
          {who} to join. {intro} Sign in with <strong className="font-medium text-text">{invite.email}</strong> to accept. The invite expires{' '}
          {formatDate(invite.expiresAt, new Date(0))}.
        </Message>
      </>
    )
  }

  if (viewer.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <>
        {header}
        <Message title="This invite is for a different email" action={<SignOutForInvite token={token} />}>
          The invite was sent to <strong className="font-medium text-text user-text">{invite.email}</strong>, but you’re signed in as{' '}
          <strong className="font-medium text-text user-text">{viewer.email}</strong>. Sign out, then sign in with the invited address.
        </Message>
      </>
    )
  }

  if (viewer.team || viewer.sponsor) {
    const current = viewer.team ? `Team ${viewer.team.number} · ${viewer.team.name}` : viewer.sponsor!.name
    const alreadyHere = invite.kind === 'team' ? viewer.team?.id === invite.org.id : viewer.sponsor?.id === invite.org.id
    return (
      <>
        {header}
        <Message
          title={alreadyHere ? `You’re already on ${orgLabel}` : 'You’re already part of another team or company'}
          action={
            <Button asChild>
              <Link href={homeFor(viewer)}>Go to {alreadyHere ? orgLabel : current}</Link>
            </Button>
          }
        >
          {alreadyHere
            ? 'There’s nothing to accept.'
            : `A person can belong to one team or company, and you’re on ${current}. To join ${orgLabel}, leave ${current} first (from its members list), then open this link again. Questions? Email ${SUPPORT_EMAIL}.`}
        </Message>
      </>
    )
  }

  return (
    <>
      {header}
      <Message title={`Join ${orgLabel}`}>
        {who} to join. {intro}
      </Message>
      <AcceptInvite token={token} needsTerms={!viewer.acceptedTermsAt} />
    </>
  )
}

function Message({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-h1 font-semibold tracking-tighter text-text user-text">{title}</h1>
        <p className="text-lead text-text-secondary">{children}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
  )
}

function HomeLink({ signedIn }: { signedIn: boolean }) {
  return (
    <Button asChild variant="secondary">
      <Link href={signedIn ? '/welcome' : '/login'}>{signedIn ? 'Go to FTC Pitfund' : 'Sign in'}</Link>
    </Button>
  )
}

function InviteSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-6">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-11 w-40" />
    </div>
  )
}
