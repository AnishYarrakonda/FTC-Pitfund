import { ArrowUpRight, BadgeCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicFooter, PublicHeader } from '@/components/app/public-chrome'
import { Button } from '@/components/ui/button'
import { OrgLogo } from '@/components/ui/identity'
import { InstagramIcon } from '@/components/ui/instagram-icon'
import { PdfViewer } from '@/components/ui/pdf-viewer'
import { getPublicTeam, type PublicTeam } from '@/lib/server/data/public-team'
import { formatDate } from '@/lib/shared/format'
import { instagramUrl, placeLabel } from '@/lib/shared/team'
import { displayWebsite } from '@/lib/shared/url'

import { ReportButton } from './report-button'

/*
 * The public team page (plan §2). Cached per team (lib/server/data/public-team.ts), so it is fast
 * for anyone who opens a pitch's "Team page" link. No personal data: no coach names, emails or
 * phones are selected, let alone rendered.
 */

function parseNumber(value: string) {
  return /^\d{1,6}$/.test(value) ? Number(value) : null
}

export async function generateMetadata({ params }: PageProps<'/t/[number]'>): Promise<Metadata> {
  const number = parseNumber((await params).number)
  const team = number ? await getPublicTeam(number) : null
  if (!team) return { title: 'Team not found', robots: { index: false, follow: false } }
  const title = `Team ${team.number} · ${team.name}`
  return {
    title,
    description: team.summary ?? `FTC team ${team.number} from ${placeLabel(team) || 'the FIRST Tech Challenge'} on FTC Pitfund.`,
    // The share image is ./opengraph-image.tsx: the team card with the deck's first page.
    openGraph: { title, description: team.summary ?? undefined, type: 'profile' },
  }
}

// A missing or suspended team renders the 404 page. In `next dev` the lookup runs before anything
// streams, so the status is 404. A production build streams the route's static shell first (Cache
// Components), so there it is a soft 404: status 200, the 404 UI and `noindex`. A real 404 would
// need a database lookup in proxy.ts, which stays session-only (plan §5). The lookup is cached, so
// blocking on it costs a cache read.
export const instant = false

export default async function PublicTeamPage({ params }: PageProps<'/t/[number]'>) {
  const number = parseNumber((await params).number)
  const team = number ? await getPublicTeam(number) : null
  if (!team) notFound()
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <PublicHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
      <main id="main" className="flex-1">
        <TeamProfile team={team} />
      </main>
      <PublicFooter />
    </div>
  )
}

function TeamProfile({ team }: { team: PublicTeam }) {
  const place = placeLabel(team)

  return (
    // max-w-app, the same width as the header bar above it. This used to be max-w-reading (720px)
    // under a 1080px header, which left the whole page looking like a narrow ribbon pushed off
    // centre on anything wider than a laptop.
    <div className="mx-auto w-full max-w-app px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:px-8">
      <header className="grid gap-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <OrgLogo name={team.name} src={team.logoUrl} size="xl" />
          <div className="grid min-w-0 gap-1.5">
            {/* A public page people land on, not a dense app screen: the name carries the page. */}
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-3 text-h1 font-semibold tracking-tighter text-text sm:text-display">
              <span className="min-w-0 user-text">{team.name}</span>
              {team.verified ? (
                <span className="inline-flex shrink-0 text-accent" title="Checked by FTC Pitfund">
                  <BadgeCheck aria-hidden="true" className="size-6 sm:size-7" />
                  <span className="sr-only">Checked by FTC Pitfund</span>
                </span>
              ) : null}
            </h1>
            <p className="min-w-0 text-lead text-text-secondary user-text">
              <span className="tabular">Team {team.number}</span>
              {place ? ` · ${place}` : null}
            </p>
          </div>
        </div>
        {team.summary ? <p className="max-w-reading text-lead text-text user-text sm:text-h3">{team.summary}</p> : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body">
          {team.website ? (
            <a href={team.website} target="_blank" rel="noreferrer nofollow" className="inline-flex min-h-8 min-w-0 items-center gap-1 font-medium text-accent hover:text-accent-hover">
              <span className="min-w-0 user-text">{displayWebsite(team.website)}</span>
              <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
            </a>
          ) : null}
          {team.instagram ? (
            <a
              href={instagramUrl(team.instagram)}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-flex min-h-8 min-w-0 items-center gap-1.5 font-medium text-accent hover:text-accent-hover"
            >
              <InstagramIcon className="size-4 shrink-0" />
              <span className="min-w-0 user-text">@{team.instagram}</span>
            </a>
          ) : null}
          {team.deck ? <span className="text-text-tertiary">Deck updated {formatDate(team.deck.updatedAt, new Date(0))}</span> : null}
        </div>
      </header>

      <section aria-labelledby="deck-heading" className="mt-12 grid gap-4 border-t border-border pt-8">
        <h2 id="deck-heading" className="text-h3 font-semibold tracking-tight text-text">
          Sponsorship deck
        </h2>
        {/* The column is wider than the deck wants to be: a Letter page rendered 1080px across is
            uncomfortable to read, so the deck keeps a sensible reading width inside it. */}
        <div className="w-full max-w-[820px]">
          {team.deck ? (
            <PdfViewer src={team.deck.url} downloadHref={team.deck.downloadUrl} title={`Team ${team.number} sponsorship deck`} pages={team.deck.pages} thumbnailSrc={team.deck.thumbUrl} priority />
          ) : (
            <p className="rounded-menu bg-canvas px-5 py-10 text-center text-body text-text-secondary">This team hasn’t uploaded its sponsorship deck yet.</p>
          )}
        </div>
      </section>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-small text-text-tertiary">
        <p>Is something wrong with this page?</p>
        <ReportButton teamNumber={team.number} />
      </div>
    </div>
  )
}
