'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LinkPendingIndicator } from '@/components/ui/link-status'
import { cn } from '@/lib/shared/cn'
import { isActive, type NavItem } from '@/lib/shared/nav'

export function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname()
  if (items.length === 0) return null
  return (
    <nav aria-label="Main" className={cn('hidden items-center gap-1 sm:flex', className)}>
      {items.map((item) => {
        const active = isActive(item, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-8 items-center rounded-control px-2.5 text-body font-medium whitespace-nowrap transition-colors duration-120',
              active ? 'text-text' : 'text-text-secondary hover:bg-muted hover:text-text',
            )}
          >
            {item.label}
            {/* Positioned outside the flow so the label and its underline stay centered. */}
            <LinkPendingIndicator className="absolute top-1/2 -right-2 -translate-y-1/2" />
            {active ? <span aria-hidden="true" className="absolute inset-x-2.5 -bottom-[13px] h-0.5 rounded-full bg-text" /> : null}
          </Link>
        )
      })}
    </nav>
  )
}
