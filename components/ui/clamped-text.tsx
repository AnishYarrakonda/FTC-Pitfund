'use client'

import { useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/shared/cn'

const clampClass = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4', 6: 'line-clamp-6' } as const

/** Long user text in a list: clamped to a few lines, with "Show more" only when it actually overflows. */
export function ClampedText({ children, lines = 3, className }: { children: string; lines?: keyof typeof clampClass; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children, expanded])

  return (
    <div className="grid min-w-0 justify-items-start gap-1">
      <p ref={ref} className={cn('min-w-0 user-text-block', !expanded && clampClass[lines], className)}>
        {children}
      </p>
      {overflows || expanded ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="text-small font-medium text-accent hover:text-accent-hover">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
}
