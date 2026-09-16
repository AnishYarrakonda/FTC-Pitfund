'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useTransition, type ReactNode } from 'react'

import { SearchInput } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/shared/cn'
import { PITCH_FILTER_LABEL, PITCH_FILTERS, type PitchFilter } from '@/lib/shared/directory'

/**
 * Search and the pitch-status chips. Search is debounced, lives in the URL and is answered on the
 * server; the chips say how many companies fall in each state so a coach can see at a glance how
 * much of the directory is still untouched. While new results load, the list dims and says so.
 */
export function DirectoryControls({
  q,
  show,
  counts,
  children,
}: {
  q: string
  show: PitchFilter
  counts: Record<PitchFilter, number>
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const navigate = useCallback(
    (next: { q?: string; show?: PitchFilter }) => {
      const sp = new URLSearchParams()
      const nextQ = next.q ?? q
      const nextShow = next.show ?? show
      if (nextQ) sp.set('q', nextQ)
      if (nextShow !== 'all') sp.set('show', nextShow)
      const query = sp.toString()
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
    },
    [pathname, q, router, show],
  )

  const onSearch = useCallback((value: string) => navigate({ q: value }), [navigate])

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <SearchInput label="Search companies by name" placeholder="Search companies" defaultValue={q} onSearch={onSearch} className="sm:max-w-sm" debounceMs={300} />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by what you have pitched">
          {PITCH_FILTERS.map((f) => (
            <Chip key={f} active={show === f} onClick={() => navigate({ show: f })} count={counts[f]}>
              {PITCH_FILTER_LABEL[f]}
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

function Chip({ active, onClick, count, children }: { active: boolean; onClick: () => void; count: number; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-control border px-3 text-small font-medium transition-colors duration-120',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active ? 'border-text bg-text text-white' : 'border-border-strong bg-surface text-text-secondary hover:bg-muted hover:text-text',
      )}
    >
      {children}
      <span className={cn('tabular', active ? 'text-white/70' : 'text-text-tertiary')}>{count}</span>
    </button>
  )
}
