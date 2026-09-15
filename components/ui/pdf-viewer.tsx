'use client'

import { ChevronDown, ChevronUp, Download, FileText } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react'

import { Button } from './button'
import { Spinner } from './spinner'

/*
 * PdfViewer (plan §7). The viewer is excluded from first-load JS (plan §6): this shell renders the
 * toolbar and the deck's first-page thumbnail, and loads ./pdf-viewer-impl.tsx (and pdf.js) when
 * the viewer comes within 300 px of the viewport or the reader presses "View deck".
 */

export const LETTER_RATIO = 792 / 612

export type PdfViewerProps = {
  src: string
  title: string
  pages?: number | null
  thumbnailSrc?: string | null
  downloadHref?: string | null
  /** Load right away instead of on approach. */
  eager?: boolean
  /** Preload the first-page thumbnail: the viewer is the page's main content. */
  priority?: boolean
  className?: string
}

let implLoader: Promise<ComponentType<PdfViewerProps>> | null = null
const loadImpl = () => (implLoader ??= import('./pdf-viewer-impl').then((m) => m.default))

export function PdfViewer(props: PdfViewerProps) {
  const { title, pages, thumbnailSrc, downloadHref, src, eager = false, priority = false, className } = props
  const rootRef = useRef<HTMLElement>(null)
  const [requested, setRequested] = useState(eager)
  const [Impl, setImpl] = useState<ComponentType<PdfViewerProps> | null>(null)

  // Start loading when the viewer comes near the viewport.
  useEffect(() => {
    if (requested) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRequested(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [requested])

  useEffect(() => {
    if (!requested) return
    let cancelled = false
    void loadImpl().then((impl) => {
      if (!cancelled) setImpl(() => impl)
    })
    return () => {
      cancelled = true
    }
  }, [requested])

  if (Impl) return <Impl {...props} />

  const count = pages ?? 0
  return (
    <figure ref={rootRef} className={['grid min-w-0 gap-3', className].filter(Boolean).join(' ')} aria-label={title}>
      <PdfToolbar title={title} label={count ? `${count} ${count === 1 ? 'page' : 'pages'}` : 'PDF'} ready={false} href={downloadHref ?? src} download={Boolean(downloadHref)} />
      <div className="grid min-w-0 gap-3">
        <PdfPlaceholderPages count={Math.max(1, count)} thumbnailSrc={thumbnailSrc} loading={requested} onRequest={() => setRequested(true)} priority={priority} />
      </div>
    </figure>
  )
}

export function PdfToolbar({
  title,
  label,
  ready,
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  onKeyDown,
  href,
  download,
}: {
  title: string
  label: string
  ready: boolean
  canPrev?: boolean
  canNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  onKeyDown?: (e: KeyboardEvent) => void
  href: string
  /** A same-origin download link; otherwise the PDF opens in a new tab. */
  download: boolean
}) {
  return (
    <div role="toolbar" aria-label={`${title} pages`} onKeyDown={onKeyDown} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="min-w-0 text-small text-text-tertiary tabular" aria-live="polite">
        {label}
      </span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="sm" aria-label="Previous page" disabled={!ready || !canPrev} onClick={onPrev}>
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Next page" disabled={!ready || !canNext} onClick={onNext}>
          <ChevronDown aria-hidden="true" />
        </Button>
        <a
          href={href}
          {...(download ? {} : { target: '_blank', rel: 'noreferrer' })}
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-small font-medium text-text-secondary transition-colors duration-120 hover:bg-muted hover:text-text"
        >
          <Download aria-hidden="true" className="size-3.5" />
          Download PDF
        </a>
      </span>
    </div>
  )
}

/** Page-shaped placeholders: the first page's thumbnail, then skeletons, with the load state. */
export function PdfPlaceholderPages({
  count,
  thumbnailSrc,
  loading,
  onRequest,
  priority = false,
}: {
  count: number
  thumbnailSrc?: string | null
  loading: boolean
  onRequest?: () => void
  /** The thumbnail is the page's main image (a public team page). */
  priority?: boolean
}) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="relative overflow-hidden rounded-dialog border border-border bg-surface" style={{ aspectRatio: `1 / ${LETTER_RATIO}` }}>
      {i === 0 && thumbnailSrc ? (
        // Through the image optimizer: same origin as the page (no extra connection before it paints) and sized to the column.
        <Image src={thumbnailSrc} alt="" fill sizes="(min-width: 760px) 720px, calc(100vw - 32px)" preload={priority} fetchPriority={priority ? 'high' : undefined} className="object-cover object-top" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-muted" />
      )}
      {i === 0 ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
          {loading || !onRequest ? (
            <p className="flex items-center gap-2 rounded-menu bg-surface/95 px-3 py-2 text-body text-text-secondary shadow-sm" aria-live="polite">
              <Spinner className="text-accent" /> Loading the deck…
            </p>
          ) : (
            <Button variant="secondary" size="sm" onClick={onRequest}>
              <FileText aria-hidden="true" />
              View deck
            </Button>
          )}
        </div>
      ) : null}
    </div>
  ))
}
