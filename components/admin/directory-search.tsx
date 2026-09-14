'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useTransition, type ReactNode } from 'react'

import { SearchInput } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/shared/cn'

/** Search in the URL (rendered on the server); the results dim and say so while they load. */
export function DirectorySearch({ q, tab, label, placeholder, children }: { q: string; tab: string; label: string; placeholder: string; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const onSearch = useCallback(
    (value: string) => {
      const sp = new URLSearchParams()
      if (tab !== 'teams') sp.set('tab', tab)
      if (value) sp.set('q', value)
      const query = sp.toString()
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
    },
    [pathname, router, tab],
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput key={tab} label={label} placeholder={placeholder} defaultValue={q} onSearch={onSearch} className="w-full sm:max-w-sm" debounceMs={300} />
        <span aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-small text-text-tertiary transition-opacity duration-120', pending ? 'opacity-100' : 'opacity-0')}>
          {pending ? (
            <>
              <Spinner size={12} /> Searching…
            </>
          ) : null}
        </span>
      </div>
      <div aria-busy={pending || undefined} className={cn('min-w-0 transition-opacity duration-120', pending && 'opacity-60')}>
        {children}
      </div>
    </div>
  )
}
