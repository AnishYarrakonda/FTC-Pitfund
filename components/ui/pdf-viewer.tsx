'use client'

import { ChevronLeft, ChevronRight, ExternalLink, FileText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/shared/cn'

import { Button } from './button'
import { Spinner } from './spinner'

type PdfState = 'idle' | 'loading' | 'ready' | 'error'
type PdfDocument = { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> }
type PdfPage = {
  getViewport(opts: { scale: number }): { width: number; height: number }
  render(opts: { canvas: HTMLCanvasElement; viewport: { width: number; height: number } }): { promise: Promise<void>; cancel(): void }
}

/**
 * Lazy PDF viewer. pdf.js (~400 KB) is not in any route bundle: it loads when the viewer
 * scrolls into view or the reader asks for it, then renders one page at a time to a canvas.
 * Always offers the original file as a fallback link.
 */
export function PdfViewer({
  src,
  title,
  pages,
  thumbnailSrc,
  eager = false,
  className,
}: {
  src: string
  title: string
  pages?: number | null
  thumbnailSrc?: string | null
  eager?: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<PdfDocument | null>(null)
  const [loadState, setState] = useState<PdfState>('idle')
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(pages ?? 0)
  const [requested, setRequested] = useState(eager)
  // Loading is derived: requested but not yet ready or failed.
  const state: PdfState = requested && loadState === 'idle' ? 'loading' : loadState

  useEffect(() => {
    if (requested) return
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRequested(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [requested])

  useEffect(() => {
    if (!requested) return
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const doc = (await pdfjs.getDocument({ url: src }).promise) as unknown as PdfDocument
        if (cancelled) {
          await doc.destroy()
          return
        }
        docRef.current = doc
        setPageCount(doc.numPages)
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
      void docRef.current?.destroy()
      docRef.current = null
    }
  }, [requested, src])

  const renderPage = useCallback(async (n: number) => {
    const doc = docRef.current
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!doc || !canvas || !container) return
    const pdfPage = await doc.getPage(n)
    const base = pdfPage.getViewport({ scale: 1 })
    const ratio = window.devicePixelRatio || 1
    const scale = (container.clientWidth / base.width) * ratio
    const viewport = pdfPage.getViewport({ scale })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.aspectRatio = `${base.width} / ${base.height}`
    await pdfPage.render({ canvas, viewport }).promise
  }, [])

  useEffect(() => {
    if (state === 'ready') void renderPage(page).catch(() => setState('error'))
  }, [state, page, renderPage])

  return (
    <figure className={cn('grid min-w-0 gap-3', className)}>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-dialog border border-border bg-canvas"
        style={{ aspectRatio: '612 / 792' }}
      >
        {state === 'ready' ? (
          <canvas ref={canvasRef} className="block h-auto w-full bg-white" aria-label={`${title}, page ${page} of ${pageCount}`} role="img" />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            {thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage-hosted thumbnail, shown only until pdf.js is ready
              <img src={thumbnailSrc} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
            ) : null}
            <div className="relative grid justify-items-center gap-3 rounded-menu bg-surface/90 px-5 py-4 text-center">
              {state === 'error' ? (
                <>
                  <FileText aria-hidden="true" className="size-5 text-text-tertiary" />
                  <p className="text-body text-text">Couldn&apos;t display this PDF here.</p>
                  <a href={src} target="_blank" rel="noreferrer" className="text-small font-medium text-accent hover:text-accent-hover">
                    Open the PDF
                  </a>
                </>
              ) : state === 'loading' ? (
                <p className="flex items-center gap-2 text-body text-text-secondary" aria-live="polite">
                  <Spinner className="text-accent" /> Loading the deck…
                </p>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setRequested(true)}>
                  <FileText aria-hidden="true" />
                  View deck
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 text-small text-text-tertiary">
          {pageCount ? (
            <span className="tabular">
              Page {page} of {pageCount}
            </span>
          ) : (
            title
          )}
        </span>
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Previous page" disabled={state !== 'ready' || page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Next page" disabled={state !== 'ready' || page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight aria-hidden="true" />
          </Button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-small font-medium text-text-secondary hover:bg-muted hover:text-text"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            Open PDF
          </a>
        </span>
      </figcaption>
    </figure>
  )
}
