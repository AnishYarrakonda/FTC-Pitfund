'use client'

import { useLinkStatus } from 'next/link'

import { cn } from '@/lib/shared/cn'

import { Spinner } from './spinner'

/**
 * Put inside a next/link to show a pending indicator while that navigation loads
 * (plan §3.1 #6). Appears only after a short delay so fast navigations don't flicker.
 */
export function LinkPendingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden="true"
      data-pending={pending ? '' : undefined}
      className={cn(
        'inline-flex shrink-0 opacity-0 transition-opacity duration-120',
        pending && 'opacity-100 [transition-delay:120ms]',
        className,
      )}
    >
      <Spinner size={12} />
    </span>
  )
}
