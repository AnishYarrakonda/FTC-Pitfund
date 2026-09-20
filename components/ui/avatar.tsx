import { cn } from '@/lib/shared/cn'
import { initials } from '@/lib/shared/format'

const avatarSizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-caption', md: 'size-10 text-small', lg: 'size-14 text-lead' }

/**
 * A person's photo over their initials. No script: if the photo fails to load, an <img alt="">
 * renders nothing and the initials underneath show through.
 */
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
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-medium text-text-secondary select-none', avatarSizes[size], className)}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars are tiny and come from storage
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
      ) : null}
    </span>
  )
}
