import { cn } from '@/lib/shared/cn'

/** Decorative spinner. Always pair it with a text label; it is aria-hidden. */
export function Spinner({ className, size = 16 }: { className?: string; size?: 12 | 14 | 16 | 20 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={cn('shrink-0 animate-spin motion-reduce:animate-pulse', className)}
      fill="none"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.75" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
