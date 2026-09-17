import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ConnectedPanel } from '@/components/pitch/connected-panel'
import { PitchView } from '@/components/pitch/pitch-view'
import { Banner, StatusBadge } from '@/components/ui/feedback'
import { TeamMark } from '@/components/ui/identity'
import { PageContainer } from '@/components/ui/page'
import { PdfViewer } from '@/components/ui/pdf-viewer'
import { requireApprovedSponsor } from '@/lib/server/authz'
import { getInboxPitch } from '@/lib/server/data/inbox'
import { guardPage } from '@/lib/server/page-guards'
import { AppError } from '@/lib/server/result'
import { formatDate } from '@/lib/shared/format'
import { SPONSOR_PITCH_STATUS } from '@/lib/shared/labels'
import { placeLabel } from '@/lib/shared/team'

import { InboxActions } from './inbox-actions'

export const metadata: Metadata = { title: 'Pitch' }

// The guard redirects an org that isn't approved yet, so this route can't be validated as instant —
// the same reason the workspace layout opts out.
export const instant = false

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function InboxPitchPage({ params }: PageProps<'/inbox/[id]'>) {
  const [viewer, { id }] = await Promise.all([guardPage(() => requireApprovedSponsor()), params])
  if (!UUID.test(id)) notFound()
  const pitch = await getInboxPitch(viewer, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound()
    throw e
  })
  const { team } = pitch.view
  const teamLabel = `Team ${team.number} · ${team.name}`
  const status = SPONSOR_PITCH_STATUS[pitch.status]
  const canRespond = pitch.status === 'sent' && viewer.sponsor.status === 'approved'
  const emailNote =
    pitch.teamEmail === 'delayed'
      ? `Email delivery is delayed until tomorrow. ${teamLabel} will still see it in FTC Pitfund.`
      : pitch.teamEmail === 'failed'
        ? `We couldn’t email ${teamLabel}. They can still see it in FTC Pitfund.`
        : null

  return (
    <PageContainer width="reading" className={canRespond ? 'pb-0 sm:pb-0' : undefined}>
      <Link href="/inbox" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Pitches
      </Link>

      <header className="mt-6 grid gap-2 border-b border-border pb-6">
        <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">Pitch from {teamLabel}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-secondary">
          {status ? <StatusBadge label={status.label} tone={status.tone} /> : null}
          {pitch.receivedAt ? <span>Received {formatDate(pitch.receivedAt)}</span> : null}
          {pitch.respondedAt && pitch.respondedByName && !pitch.withdrawn ? (
            <span className="min-w-0 text-text-tertiary user-text">
              Answered by {pitch.respondedByName} on {formatDate(pitch.respondedAt)}
            </span>
          ) : null}
        </p>
      </header>

      {pitch.withdrawn ? (
        <div className="mt-8 grid gap-6">
          <Banner tone="info" title={`${teamLabel} withdrew this pitch.`}>
            You don’t need to respond. It can’t be answered anymore.
          </Banner>
          <TeamMark name={team.name} number={team.number} logoSrc={team.logoUrl} verified={team.verified} meta={placeLabel(team) || null} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 empty:hidden">
            {pitch.status === 'matched' && pitch.contact ? (
              <ConnectedPanel
                title={`You’re connected with ${teamLabel}`}
                description={emailNote ?? 'We emailed you both. Reach out and take it from here.'}
                contactLabel="Coach"
                contact={{ name: pitch.contact.name, email: pitch.contact.email, phone: pitch.contact.phone, teamUrl: pitch.contact.teamUrl }}
              />
            ) : null}
            {pitch.status === 'declined' ? (
              <Banner tone="info" title="Marked not a fit">
                <span className="grid gap-1">
                  {pitch.declineReason ? <span className="user-text-block">Reason given: {pitch.declineReason}</span> : <span>No reason was given.</span>}
                  <span>{emailNote ?? `${teamLabel} was told.`}</span>
                </span>
              </Banner>
            ) : null}
          </div>

          <div className="mt-8">
            <PitchView pitch={pitch.view} deck="none" headingLevel={2} />
          </div>

          <section aria-labelledby="deck-heading" className="mt-8 grid gap-3 border-t border-border pt-6">
            <h2 id="deck-heading" className="text-small font-medium text-text-tertiary">
              Sponsorship deck
            </h2>
            {pitch.deck ? (
              <PdfViewer src={pitch.deck.url} downloadHref={pitch.deck.downloadUrl} title={`Team ${team.number} sponsorship deck`} pages={pitch.deck.pages} thumbnailSrc={pitch.deck.thumbUrl} />
            ) : (
              <p className="rounded-menu bg-canvas px-5 py-10 text-center text-body text-text-secondary">This team hasn’t uploaded a deck.</p>
            )}
          </section>

          {canRespond ? <InboxActions pitchId={pitch.id} teamLabel={teamLabel} /> : null}
        </>
      )}
    </PageContainer>
  )
}
