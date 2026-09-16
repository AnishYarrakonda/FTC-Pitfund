import Link from 'next/link'

import { StatusBadge } from '@/components/ui/feedback'
import { TeamMark } from '@/components/ui/identity'
import { LinkPendingIndicator } from '@/components/ui/link-status'
import { formatRelative } from '@/lib/shared/format'
import { SPONSOR_PITCH_STATUS } from '@/lib/shared/labels'
import { placeLabel } from '@/lib/shared/team'
import type { PitchStatus } from '@/lib/shared/types'

export type InboxRowData = {
  id: string
  status: PitchStatus
  team: { number: number; name: string; logoUrl: string | null; verified: boolean; location: string | null; summary: string | null }
  ask: string | null
  receivedAt: Date | string
  respondedAt: Date | string | null
}

/** One pitch in the company inbox: who, where, their one-liner, the ask and when it arrived. */
export function InboxRow({ pitch, href, now }: { pitch: InboxRowData; href: string | null; now?: Date }) {
  const status = SPONSOR_PITCH_STATUS[pitch.status]
  const place = placeLabel(pitch.team)
  const when = pitch.status === 'sent' || !pitch.respondedAt ? `Received ${formatRelative(pitch.receivedAt, now)}` : `Answered ${formatRelative(pitch.respondedAt, now)}`
  const mark = <TeamMark name={pitch.team.name} number={pitch.team.number} logoSrc={pitch.team.logoUrl} verified={pitch.team.verified} meta={place || null} />
  return (
    <div className="group relative flex min-w-0 flex-col gap-3 px-4 py-4 transition-colors duration-120 hover:bg-canvas sm:flex-row sm:items-start sm:gap-6 sm:px-5">
      <div className="grid min-w-0 flex-1 gap-2">
        {href ? (
          <Link href={href} className="flex min-w-0 items-center gap-2 after:absolute after:inset-0 after:content-['']">
            {mark}
            <LinkPendingIndicator />
          </Link>
        ) : (
          mark
        )}
        {pitch.team.summary ? <p className="min-w-0 pl-[52px] text-body text-text-secondary line-clamp-2 user-text">{pitch.team.summary}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pl-[52px] sm:grid sm:justify-items-end sm:gap-1 sm:pl-0 sm:text-right">
        {status && pitch.status !== 'sent' ? <StatusBadge label={status.label} tone={status.tone} /> : null}
        <span className="text-body font-medium text-text tabular">{pitch.ask ?? 'No specific ask'}</span>
        <span className="text-small text-text-tertiary">{when}</span>
      </div>
    </div>
  )
}
