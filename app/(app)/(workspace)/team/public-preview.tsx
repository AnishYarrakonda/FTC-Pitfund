import { ArrowUpRight, FileText } from 'lucide-react'

import { TeamMark } from '@/components/ui/identity'
import type { TeamProfile } from '@/lib/server/data/teams'
import { placeLabel } from '@/lib/shared/team'

/** A small card of what the public page shows, linking to it. */
export function PublicPreview({ profile }: { profile: TeamProfile }) {
  return (
    <a
      href={`/t/${profile.number}`}
      target="_blank"
      rel="noreferrer"
      className="group grid min-w-0 gap-4 rounded-dialog border border-border bg-surface p-5 transition-colors duration-120 hover:border-border-strong"
    >
      <span className="flex items-center justify-between gap-3 text-small text-text-tertiary">
        Public page
        <span className="inline-flex items-center gap-1 font-medium text-accent group-hover:text-accent-hover">
          View <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </span>
      </span>
      <TeamMark name={profile.name} number={profile.number} logoSrc={profile.logoUrl} verified={profile.status === 'approved'} meta={placeLabel(profile) || null} size="sm" />
      {profile.summary ? (
        <span className="text-body text-text-secondary user-text">{profile.summary}</span>
      ) : (
        <span className="text-body text-text-tertiary">Add a one-line summary so companies know what your team is about.</span>
      )}
      <span className="relative block aspect-[612/792] w-full overflow-hidden rounded-menu border border-border bg-canvas">
        {profile.deck?.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage-hosted page-1 thumbnail
          <img src={profile.deck.thumbUrl} alt="" className="size-full object-cover object-top" />
        ) : (
          <span className="absolute inset-0 grid place-items-center gap-2 px-6 text-center text-small text-text-tertiary">
            <span className="grid justify-items-center gap-2">
              <FileText aria-hidden="true" className="size-5" />
              {profile.deck ? 'Deck uploaded' : 'No deck yet'}
            </span>
          </span>
        )}
      </span>
    </a>
  )
}
