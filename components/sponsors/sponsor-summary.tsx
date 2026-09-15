import Link from 'next/link'
import type { ReactNode } from 'react'

import { OrgLogo } from '@/components/ui/identity'
import { LinkPendingIndicator } from '@/components/ui/link-status'
import { cn } from '@/lib/shared/cn'
import { SUPPORT_TYPE_LABEL } from '@/lib/shared/labels'
import type { SupportType } from '@/lib/shared/types'

/*
 * How a company appears to coaches: the directory row and the profile header. Prompt 3 reuses
 * both for the company editor's "What teams see" preview.
 */

export type SponsorSummaryData = {
  id: string
  name: string
  logoUrl: string | null
  city: string | null
  state: string | null
  region: string | null
  about: string | null
  supportTypes: SupportType[]
}

export function sponsorPlace(s: Pick<SponsorSummaryData, 'city' | 'state' | 'region'>) {
  const place = [s.city, s.state].filter(Boolean).join(', ')
  return [place, s.region].filter(Boolean).join(' · ')
}

export function supportTypesLabel(types: SupportType[]) {
  return types.map((t) => SUPPORT_TYPE_LABEL[t]).join(' · ')
}

/** A directory row. `href` null renders it as a static preview (no link). */
export function SponsorRow({ sponsor, href, action, className }: { sponsor: SponsorSummaryData; href: string | null; action?: ReactNode; className?: string }) {
  const place = sponsorPlace(sponsor)
  const name = <span className="min-w-0 text-body font-semibold text-text user-text">{sponsor.name}</span>
  return (
    <div className={cn('flex min-w-0 flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:gap-6 sm:px-5', className)}>
      <div className="flex min-w-0 flex-1 gap-4">
        <OrgLogo name={sponsor.name} src={sponsor.logoUrl} size="md" />
        <div className="grid min-w-0 flex-1 gap-1">
          {href ? (
            <Link href={href} className="inline-flex min-w-0 items-center gap-2 hover:underline hover:decoration-border-strong hover:underline-offset-4">
              {name}
              <LinkPendingIndicator />
            </Link>
          ) : (
            name
          )}
          {place ? <p className="min-w-0 text-small text-text-tertiary line-clamp-1 user-text">{place}</p> : null}
          {sponsor.about ? (
            <p className="mt-1 min-w-0 text-body text-text-secondary line-clamp-2 user-text">
              <span className="sr-only">What we look for: </span>
              {sponsor.about}
            </p>
          ) : null}
          {sponsor.supportTypes.length ? <p className="mt-1 text-small text-text-tertiary">{supportTypesLabel(sponsor.supportTypes)}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 pl-14 sm:pl-0">{action}</div> : null}
    </div>
  )
}
