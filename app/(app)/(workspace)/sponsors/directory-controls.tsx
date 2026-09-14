'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useTransition, type ReactNode } from 'react'

import { SearchInput } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/shared/cn'
import { SUPPORT_TYPE_LABEL } from '@/lib/shared/labels'
import { SUPPORT_TYPES, type SupportType } from '@/lib/shared/types'

/**
 * Search (debounced, in the URL, rendered on the server) and support-type chips. While new
 * results load, the list dims and says so; nothing jumps.
 */
export function DirectoryControls({ q, type, children }: { q: string; type: SupportType | null; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const navigate = useCallback(
    (next: { q?: string; type?: SupportType | null }) => {
      const sp = new URLSearchParams()
      const nextQ = next.q ?? q
      const nextType = next.type === undefined ? type : next.type
      if (nextQ) sp.set('q', nextQ)
      if (nextType) sp.set('type', nextType)
      const query = sp.toString()
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
    },
    [pathname, q, router, type],
  )

  const onSearch = useCallback((value: string) => navigate({ q: value }), [navigate])

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <SearchInput label="Search companies by name" placeholder="Search companies" defaultValue={q} onSearch={onSearch} className="sm:max-w-sm" debounceMs={300} />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by support type">
          <Chip active={!type} onClick={() => navigate({ type: null })}>
            All
          </Chip>
          {SUPPORT_TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => navigate({ type: type === t ? null : t })}>
              {SUPPORT_TYPE_LABEL[t]}
            </Chip>
          ))}
          <span aria-live="polite" className={cn('ml-1 inline-flex items-center gap-1.5 text-small text-text-tertiary transition-opacity duration-120', pending ? 'opacity-100' : 'opacity-0')}>
            {pending ? (
              <>
                <Spinner size={12} /> Updating results…
              </>
            ) : null}
          </span>
        </div>
      </div>
      <div aria-busy={pending || undefined} className={cn('min-w-0 transition-opacity duration-120', pending && 'opacity-60')}>
        {children}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-8 rounded-control border px-3 text-small font-medium transition-colors duration-120',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active ? 'border-text bg-text text-white' : 'border-border-strong bg-surface text-text-secondary hover:bg-muted hover:text-text',
      )}
    >
      {children}
    </button>
  )
}
