import { BadgeCheck } from 'lucide-react'
import { Avatar as AvatarPrimitive } from 'radix-ui'

import { cn } from '@/lib/shared/cn'
import { initials } from '@/lib/shared/format'

/* Avatar (people), OrgLogo (teams/companies) and TeamMark (logo + name + verified check). */

const avatarSizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-caption', md: 'size-10 text-small', lg: 'size-14 text-lead' }

export function Avatar({
  name,
  src,
  size = 'sm',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof avatarSizes
  className?: string
}) {
  return (
    <AvatarPrimitive.Root
      className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-medium text-text-secondary select-none', avatarSizes[size], className)}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : null}
      <AvatarPrimitive.Fallback delayMs={src ? 400 : 0} aria-hidden="true">
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

const logoSizes = { sm: 'size-8 rounded-control text-caption', md: 'size-10 rounded-menu text-small', lg: 'size-16 rounded-dialog text-lead', xl: 'size-20 rounded-dialog text-h3' }

/** A team or company logo; falls back to initials on a neutral tile. Decorative by default. */
export function OrgLogo({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof logoSizes
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden border border-border bg-canvas font-semibold text-text-secondary select-none',
        logoSizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos are small, already sized, and served from storage
        <img src={src} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

export function VerifiedCheck({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center text-accent', className)} title="Verified by FTC Pitfund">
      <BadgeCheck aria-hidden="true" className="size-4" />
      <span className="sr-only">Verified</span>
    </span>
  )
}

/** Logo + team name + number + verified check. Names wrap (never overflow). */
export function TeamMark({
  name,
  number,
  logoSrc,
  verified,
  meta,
  size = 'md',
  className,
}: {
  name: string
  number?: number | null
  logoSrc?: string | null
  verified?: boolean
  /** Secondary line, e.g. "Austin, TX" */
  meta?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', size === 'lg' && 'gap-4', className)}>
      <OrgLogo name={name} src={logoSrc} size={size === 'lg' ? 'lg' : size} />
      <span className="grid min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'min-w-0 font-medium text-text user-text',
              size === 'lg' ? 'text-h2 font-semibold tracking-tighter' : size === 'md' ? 'text-body' : 'text-small',
            )}
          >
            {name}
          </span>
          {verified ? <VerifiedCheck /> : null}
        </span>
        {number || meta ? (
          <span className={cn('min-w-0 text-text-tertiary user-text', size === 'lg' ? 'text-body' : 'text-small')}>
            {number ? <span className="tabular">Team {number}</span> : null}
            {number && meta ? ' · ' : null}
            {meta}
          </span>
        ) : null}
      </span>
    </span>
  )
}
