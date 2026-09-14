'use client'

import type { ReactNode } from 'react'

import { fakeSlowSuccess } from '@/app/actions/dev'
import { PitchView } from '@/components/pitch/pitch-view'
import { PitchStateAction } from '@/components/sponsors/pitch-state-action'
import { SponsorRow, type SponsorSummaryData } from '@/components/sponsors/sponsor-summary'
import { DeckUpload } from '@/components/uploads/deck-upload'
import { LogoUpload } from '@/components/uploads/logo-upload'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { directoryState, formatAsk, type PitchViewData } from '@/lib/shared/pitch'
import { err, type Result } from '@/lib/shared/result'

/*
 * /dev/ui specimens for the coach-side components (prompt 2): PitchView, the deck and logo
 * uploads, the directory row and the team's status with a company. Uploads use fake actions that
 * fail after a moment, so choosing a file walks through the real pre-check and error states
 * without writing anything.
 */

const LONG = 'Supercalifragilisticexpialidocious'.repeat(148).slice(0, 5000)
const SENT_AT = new Date('2026-09-10T15:00:00Z')

type Deck = { name: string; src: string; pages: number | null; thumb: string | null; logo: string | null } | null

const slowUnavailable = <T,>(): Promise<Result<T>> =>
  new Promise((resolve) => setTimeout(() => resolve(err('UNAVAILABLE', 'Couldn’t reach FTC Pitfund. Check your connection.')), 900))

function Specimen({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'grid min-w-0 content-start gap-3 lg:col-span-2' : 'grid min-w-0 content-start gap-3'}>
      <p className="text-caption font-medium text-text-tertiary">{label}</p>
      <div className="min-w-0 rounded-dialog border border-border bg-surface p-5">{children}</div>
    </div>
  )
}

function pitchData(deck: Deck, variant: 'full' | 'bare' | 'long'): PitchViewData {
  const long = variant === 'long'
  const ask = variant === 'bare' ? { type: 'none' as const, amountCents: null, note: null } : { type: 'amount' as const, amountCents: long ? 99_999_999 : 150_000, note: null }
  return {
    team: {
      number: 31579,
      name: long ? LONG.slice(0, 60) : 'Exodius',
      city: long ? LONG.slice(0, 80) : 'Austin',
      state: 'TX',
      summary: variant === 'bare' ? null : long ? LONG.slice(0, 160) : 'Third-year Austin community team building a fast, reliable robot and free workshops for 600+ local students.',
      website: long ? `https://example.org/${LONG.slice(0, 280)}` : 'https://exodiusftc.com',
      logoUrl: variant === 'bare' ? null : (deck?.logo ?? null),
      verified: variant !== 'bare',
      deck: variant !== 'bare' && deck ? { url: deck.src, thumbUrl: deck.thumb, pages: deck.pages ?? 1 } : null,
    },
    company: { id: '00000000-0000-4000-8000-000000000000', name: long ? LONG.slice(0, 60) : 'Brightline Engineering', logoUrl: null },
    answers: [
      { questionId: 'a', prompt: long ? LONG.slice(0, 200) : 'Walk us through one design decision from last season.', answer: long ? LONG : 'Our intake jammed on the second ring. We tried a wider funnel, then compliant wheels, and ended up with a two-stage roller.' },
      { questionId: 'b', prompt: 'Would your team want an engineer from Brightline as a mentor?', answer: '' },
    ],
    ask: { ...ask, label: formatAsk(ask) },
    submittedAt: variant === 'bare' ? null : SENT_AT,
  }
}

const SPONSOR: SponsorSummaryData = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Brightline Engineering',
  logoUrl: null,
  city: 'Austin',
  state: 'TX',
  region: 'Texas and the Southwest',
  about: 'We sponsor teams that document their engineering process and bring robotics to students who would not otherwise see it.',
  supportTypes: ['funding', 'mentorship'],
}

export function CoachSections({ deck }: { deck: Deck }) {
  const current = deck ? { url: deck.src, pages: deck.pages ?? 1, bytes: 412_000, thumbUrl: deck.thumb, updatedAt: '2026-08-25T12:00:00Z' } : null
  const uploadActions = { createUpload: () => slowUnavailable<{ signedUrl: string; path: string }>(), check: () => slowUnavailable<never>(), save: () => slowUnavailable<never>() }

  return (
    <>
      <section id="pitch-view" aria-labelledby="pitch-view-title" className="grid min-w-0 scroll-mt-20 gap-5">
        <div className="grid gap-1">
          <h2 id="pitch-view-title" className="text-h3 font-semibold tracking-tight text-text">
            Pitch view
          </h2>
          <p className="text-body text-text-secondary">The pitch exactly as a company sees it. Used by the composer preview, pitch detail, admin review and the inbox.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Specimen label="Complete: verified team, deck, ask">
            <PitchView pitch={pitchData(deck, 'full')} headingLevel={3} />
          </Specimen>
          <Specimen label="Bare: no logo, summary, deck or ask; unanswered optional question">
            <PitchView pitch={pitchData(deck, 'bare')} headingLevel={3} />
          </Specimen>
          <Specimen label="5,000-character strings" wide>
            <PitchView pitch={pitchData(deck, 'long')} headingLevel={3} />
          </Specimen>
        </div>
      </section>

      <section id="uploads" aria-labelledby="uploads-title" className="grid min-w-0 scroll-mt-20 gap-5">
        <div className="grid gap-1">
          <h2 id="uploads-title" className="text-h3 font-semibold tracking-tight text-text">
            Deck and logo uploads
          </h2>
          <p className="text-body text-text-secondary">
            Choose a file to see the browser pre-check (an 8-page or non-PDF file is rejected before any upload) and the network error with Retry. Nothing is saved here.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Specimen label="Deck: none yet">
            <DeckUpload deck={null} actions={uploadActions} />
          </Specimen>
          <Specimen label="Deck: current deck">
            <DeckUpload deck={current} actions={uploadActions} />
          </Specimen>
          <Specimen label="Logo: initials">
            <LogoUpload name="Exodius" currentUrl={null} createUpload={() => slowUnavailable()} finalize={() => slowUnavailable()} />
          </Specimen>
          <Specimen label="Logo: current image, long name">
            <LogoUpload name={LONG.slice(0, 60)} currentUrl={deck?.logo ?? null} createUpload={() => slowUnavailable()} finalize={() => slowUnavailable()} />
          </Specimen>
        </div>
      </section>

      <section id="directory" aria-labelledby="directory-title" className="grid min-w-0 scroll-mt-20 gap-5">
        <div className="grid gap-1">
          <h2 id="directory-title" className="text-h3 font-semibold tracking-tight text-text">
            Sponsor directory
          </h2>
          <p className="text-body text-text-secondary">A company row with each state of this team’s pitch, plus the directory’s empty states.</p>
        </div>
        <ul className="divide-y divide-border rounded-dialog border border-border bg-surface" aria-label="Directory rows">
          <li>
            <SponsorRow sponsor={SPONSOR} href={null} action={<ActionButton size="sm" variant="secondary" action={() => fakeSlowSuccess({})} pendingLabel="Starting…">Start pitch</ActionButton>} />
          </li>
          {(['draft', 'changes_requested', 'in_review', 'sent', 'matched', 'declined'] as const).map((status) => (
            <li key={status}>
              <SponsorRow
                sponsor={{ ...SPONSOR, id: `${SPONSOR.id}-${status}`, logoUrl: deck?.logo ?? null }}
                href={null}
                action={<PitchStateAction sponsorId={SPONSOR.id} sponsorName={SPONSOR.name} state={directoryState(SPONSOR.id, { id: `pitch-${status}`, status })} />}
              />
            </li>
          ))}
          <li>
            <SponsorRow
              sponsor={{ ...SPONSOR, name: LONG.slice(0, 60), about: LONG, region: LONG, city: LONG.slice(0, 80), supportTypes: ['funding', 'equipment', 'software', 'mentorship', 'other'] }}
              href={null}
              action={<PitchStateAction sponsorId={SPONSOR.id} sponsorName={SPONSOR.name} state={directoryState(SPONSOR.id, { id: 'p', status: 'rejected' })} />}
            />
          </li>
        </ul>
        <div className="grid gap-6 lg:grid-cols-2">
          <EmptyState
            title="No companies yet"
            description="Companies are joining FTC Pitfund. Check back soon. Meanwhile, finish your team profile."
            action={<Button>Finish your team profile</Button>}
            className="rounded-dialog border border-border bg-surface"
          />
          <EmptyState
            title="No companies match"
            description="Nothing matches “zzz”. Try a shorter name or clear the filters."
            action={<Button variant="secondary">Clear search</Button>}
            className="rounded-dialog border border-border bg-surface"
          />
        </div>
      </section>
    </>
  )
}
