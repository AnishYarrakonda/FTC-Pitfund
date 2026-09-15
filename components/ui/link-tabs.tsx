import Link from 'next/link'

import { cn } from '@/lib/shared/cn'

import { LinkPendingIndicator } from './link-status'

export type LinkTab = { key: string; label: string; href: string; count?: number }

/**
 * Tabs that are links (the selected tab lives in the URL, so it survives reloads, can be shared,
 * and paginates). Same look as Tabs; `aria-current` marks the open one.
 */
export function LinkTabs({ tabs, active, label, className }: { tabs: LinkTab[]; active: string; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      <ul className="flex max-w-full gap-5 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {tabs.map((tab) => {
          const current = tab.key === active
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                scroll={false}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'relative -mb-px inline-flex h-10 items-center gap-2 border-b-2 text-body font-medium whitespace-nowrap transition-colors duration-120',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  current ? 'border-text text-text' : 'border-transparent text-text-secondary hover:text-text',
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span
                    className={cn(
                      'inline-grid h-5 min-w-5 place-items-center rounded-control px-1.5 text-caption font-medium tabular',
                      tab.count > 0 && current ? 'bg-text text-white' : 'bg-muted text-text-secondary',
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
                <LinkPendingIndicator />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
