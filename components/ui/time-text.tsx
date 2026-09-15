import { formatDate, formatRelative } from '@/lib/shared/format'

/**
 * A date or relative time ("3 min ago") rendered inside a client component. The server and the browser format it
 * moments apart and in different time zones, so the text can legitimately differ at hydration (a minute boundary,
 * midnight in the visitor's zone). `suppressHydrationWarning` is React's escape hatch for exactly this: without it
 * the page logs hydration error #418. Server components don't need it.
 */
export function TimeText({ date, format = 'relative' }: { date: Date | string | number; format?: 'relative' | 'date' }) {
  const d = new Date(date)
  return (
    <time dateTime={d.toISOString()} suppressHydrationWarning>
      {format === 'relative' ? formatRelative(d) : formatDate(d)}
    </time>
  )
}
