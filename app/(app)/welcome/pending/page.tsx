import { Clock } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Banner } from '@/components/ui/banner'
import { buttonVariants } from '@/components/ui/button'
import { PageContainer } from '@/components/ui/page'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { pageViewer } from '@/lib/server/page-guards'
import { homeFor, viewerOrg } from '@/lib/shared/viewer'

export const metadata: Metadata = { title: 'Waiting for review' }

/**
 * Where a team or company waits after sending itself for review, and where a rejected one is told
 * why. Nothing else in the app is reachable from here: a team that hasn't been checked can't pitch,
 * and a company that hasn't been checked can't be pitched.
 */
export default async function PendingPage() {
  const viewer = await pageViewer()
  const org = viewerOrg(viewer)
  if (!org || (org.status !== 'pending' && org.status !== 'rejected')) redirect(homeFor(viewer))

  const isTeam = Boolean(viewer.team)
  const label = viewer.team ? `Team ${viewer.team.number}` : org.name
  const setupHref = isTeam ? '/welcome/team' : '/welcome/company'

  if (org.status === 'rejected') {
    return (
      <PageContainer width="form" className="sm:pt-16">
        <section className="grid gap-8">
          <header className="grid gap-2">
            <h1 className="text-h1 font-semibold tracking-tighter text-text user-text">We couldn’t approve {label} yet</h1>
            <p className="text-lead text-text-secondary">
              {org.note ? 'Here’s what we need. Fix it and send your details in again.' : 'Send your details in again once you’ve had a look.'}
            </p>
          </header>
          {org.note ? <Banner tone="warning" title="What we need">{org.note}</Banner> : null}
          <div className="flex flex-wrap gap-3">
            <Link href={setupHref} className={buttonVariants()}>
              Update your details
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={buttonVariants({ variant: 'secondary' })}>
              Email us
            </a>
          </div>
        </section>
      </PageContainer>
    )
  }

  return (
    <PageContainer width="form" className="sm:pt-16">
      <section className="grid gap-8">
        <span className="grid size-10 place-items-center rounded-menu border border-border bg-surface text-text-tertiary">
          <Clock aria-hidden="true" className="size-5" />
        </span>
        <header className="grid gap-2">
          <h1 className="text-h1 font-semibold tracking-tighter text-text user-text">We’re checking {label}</h1>
          <p className="text-lead text-text-secondary">
            A real person reads every application. We’ll email you as soon as it’s done — usually within a day.
          </p>
        </header>
        <dl className="grid gap-x-6 gap-y-1 border-y border-border py-5 text-body sm:grid-cols-[180px_1fr] sm:gap-y-3">
          <dt className="text-text-tertiary">Why we do this</dt>
          <dd className="mb-4 text-text sm:mb-0">
            {isTeam
              ? 'So nobody can sign up as your team and pitch companies in your name.'
              : 'So the teams who pitch you are real teams, and the companies they see are real companies.'}
          </dd>
          <dt className="text-text-tertiary">Something to add?</dt>
          <dd className="text-text">
            You can still change what you sent us — it goes back into the same queue.{' '}
            <Link href={setupHref} className="font-medium text-accent hover:text-accent-hover">
              Review your details
            </Link>
            .
          </dd>
        </dl>
        <p className="text-small text-text-tertiary">
          Heard nothing after a couple of days? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent hover:text-accent-hover">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </PageContainer>
  )
}
