'use client'

import { ChevronDown, ChevronUp, Download, FileText } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react'

import { Button } from './button'
import { Spinner } from './spinner'

/*
 * PdfViewer (plan §7). The viewer is excluded from first-load JS (plan §6): this shell renders the
 * figure, the toolbar and the deck's first-page thumbnail, and loads the pages (./pdf-viewer-impl.tsx,
 * then pdf.js) when the viewer comes within 300 px of the viewport or the reader presses "View deck".
 * Pages are navigable with the toolbar or ←/→/PageUp/PageDown; the file is always one click away.
 */

import type { PdfPagesProps } from './pdf-viewer-impl'

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

let implLoader: Promise<ComponentType<PdfPagesProps>> | null = null
const loadImpl = () => (implLoader ??= import('./pdf-viewer-impl').then((m) => m.default))

export function PdfViewer({ title, pages, thumbnailSrc, downloadHref, src, eager = false, priority = false, className }: PdfViewerProps) {
  const rootRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Array<HTMLDivElement | null>>([])
  const [requested, setRequested] = useState(eager)
  const [Pages, setPages] = useState<ComponentType<PdfPagesProps> | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [current, setCurrent] = useState(1)
  const ready = pageCount !== null

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
      if (!cancelled) setPages(() => impl)
    })
    return () => {
      cancelled = true
    }
  }, [requested])

  const onReady = useCallback((count: number) => setPageCount(count), [])
  const total = pageCount ?? pages ?? 0

  const goTo = (n: number) => {
    const target = Math.min(Math.max(1, n), total)
    setCurrent(target)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    pageRefs.current[target - 1]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!ready) return
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault()
      goTo(current + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      goTo(current - 1)
    }
  }

  return (
    <figure ref={rootRef} className={['grid min-w-0 gap-3', className].filter(Boolean).join(' ')} aria-label={title}>
      <PdfToolbar
        title={title}
        label={ready ? `Page ${current} of ${total}` : total ? `${total} ${total === 1 ? 'page' : 'pages'}` : 'PDF'}
        ready={ready}
        canPrev={current > 1}
        canNext={current < total}
        onPrev={() => goTo(current - 1)}
        onNext={() => goTo(current + 1)}
        onKeyDown={onKeyDown}
        href={downloadHref ?? src}
        download={Boolean(downloadHref)}
      />
      <div ref={containerRef} className="grid min-w-0 gap-3">
        {Pages ? (
          <Pages
            src={src}
            title={title}
            pages={pages}
            thumbnailSrc={thumbnailSrc}
            priority={priority}
            containerRef={containerRef}
            pageRefs={pageRefs}
            onReady={onReady}
            onVisiblePage={setCurrent}
          />
        ) : (
          <PdfPlaceholderPages count={Math.max(1, pages ?? 1)} thumbnailSrc={thumbnailSrc} loading={requested} onRequest={() => setRequested(true)} priority={priority} />
        )}
      </div>
    </figure>
  )
}

function PdfToolbar({
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
        // A page-shaped skeleton: faint text lines on white, not a grey slab.
        <div aria-hidden="true" className="absolute inset-x-[10%] top-[9%] grid animate-pulse gap-3">
          {[40, 92, 86, 64, 0, 36, 90, 82, 58, 0, 44, 88, 72].map((w, j) => (w ? <span key={j} className="h-2 rounded-full bg-muted" style={{ width: `${w}%` }} /> : <span key={j} className="h-3" />))}
        </div>
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
