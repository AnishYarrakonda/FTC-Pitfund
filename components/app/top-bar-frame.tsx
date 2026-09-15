'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'
import { isWideAppPage } from '@/lib/shared/nav'

/** The top bar's inner row. Its width follows the page below it so their left edges align. */
export function TopBarFrame({ children, area }: { children: ReactNode; area: 'app' | 'admin' }) {
  const pathname = usePathname()
  const wide = area === 'admin' || isWideAppPage(pathname)
  return <div className={cn('mx-auto flex h-14 w-full items-center gap-6 px-4 sm:px-6 lg:px-8', wide ? 'max-w-review' : 'max-w-app')}>{children}</div>
}
