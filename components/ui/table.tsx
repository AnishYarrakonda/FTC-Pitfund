import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/*
 * DataTable: a real <table> from 640 px up, a stacked list below it (plan §7 "tables become
 * stacked lists"). Rows are dividers, not cards. Pagination is cursor-based.
 */

export type Column<Row> = {
  key: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  className?: string
  /** Hide this column in the stacked mobile list (it is usually already in the primary cell). */
  hideOnMobile?: boolean
  align?: 'left' | 'right'
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  className,
}: {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  caption: string
  empty?: ReactNode
  className?: string
}) {
  if (rows.length === 0 && empty) return <>{empty}</>
  const [primary, ...rest] = columns
  return (
    <div className={cn('min-w-0 rounded-menu border border-border bg-surface', className)}>
      <table className="hidden w-full table-fixed border-collapse text-left sm:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'h-10 px-4 text-caption font-medium text-text-tertiary',
                  column.align === 'right' && 'text-right',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors duration-120 hover:bg-canvas">
              {columns.map((column) => (
                <td key={column.key} className={cn('min-w-0 px-4 py-3 align-middle text-body text-text', column.align === 'right' && 'text-right', column.className)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-border sm:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="grid min-w-0 gap-2 px-4 py-3.5">
            <div className="min-w-0">{primary.cell(row)}</div>
            <dl className="grid gap-1.5">
              {rest
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex min-w-0 items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-small text-text-tertiary">{column.header}</dt>
                    <dd className="min-w-0 text-right text-body text-text">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Pagination({
  previousHref,
  nextHref,
  summary,
  className,
}: {
  previousHref?: string | null
  nextHref?: string | null
  summary?: ReactNode
  className?: string
}) {
  const linkClass =
    'inline-flex h-8 items-center gap-1 rounded-control border border-border-strong bg-surface px-3 text-small font-medium text-text transition-colors duration-120 hover:bg-muted'
  const disabledClass = 'inline-flex h-8 items-center gap-1 rounded-control border border-border px-3 text-small font-medium text-text-tertiary'
  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4', className)}>
      <p className="min-w-0 text-small text-text-tertiary">{summary}</p>
      <div className="flex gap-2">
        {previousHref ? (
          <Link href={previousHref} className={linkClass} rel="prev">
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} className={linkClass} rel="next">
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </span>
        )}
      </div>
    </nav>
  )
}
