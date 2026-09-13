import DOMPurify from 'isomorphic-dompurify'
import { cn } from '@/lib/utils'

/**
 * Renders coach-authored rich text (TipTap HTML) as sanitized HTML.
 *
 * Rich-text fields are sanitized on input (Zod `richTextField` -> DOMPurify) and sanitized
 * AGAIN here on render as defense in depth. Without this, the stored HTML was being escaped
 * by React and shown to sponsors as literal `<p>…</p>` markup. Server-safe (no hooks/client).
 */
export function RichText({
  html,
  className,
}: {
  html: string | null | undefined
  className?: string
}) {
  if (!html || !html.trim()) return null
  const clean = DOMPurify.sanitize(html)
  if (!clean.trim()) return null
  return (
    <div
      className={cn(
        'min-w-0 break-words [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
