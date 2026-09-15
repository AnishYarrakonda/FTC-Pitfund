'use client'

import { ExternalLink, FileText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { openPdf, type PdfDocument } from '@/lib/client/pdf'
import { cn } from '@/lib/shared/cn'

import { LETTER_RATIO, PdfPlaceholderPages, PdfToolbar, type PdfViewerProps } from './pdf-viewer'

type LoadState = 'loading' | 'ready' | 'error'

/** iOS Safari refuses canvases much past ~16 M pixels; stay well under. */
const MAX_CANVAS_PIXELS = 12_000_000

/**
 * The PDF viewer itself, loaded by ./pdf-viewer.tsx when the viewer nears the viewport or the
 * reader asks for it (with pdf.js right behind it). Every page renders to a canvas (not an iframe,
 * so it works on iOS Safari), fit to the container's width, with a skeleton until it's drawn. Pages
 * are navigable with the toolbar buttons or ←/→/PageUp/PageDown, and the original file is always
 * one click away.
 */
export default function PdfViewerImpl({ src, title, pages, thumbnailSrc, downloadHref, priority, className }: PdfViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Array<HTMLDivElement | null>>([])
  const docRef = useRef<PdfDocument | null>(null)
  const [doc, setDoc] = useState<PdfDocument | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [pageCount, setPageCount] = useState(pages ?? 0)
  const [ratios, setRatios] = useState<number[]>([])
  const [width, setWidth] = useState(0)
  const [current, setCurrent] = useState(1)
  const state = loadState

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const opened = await openPdf({ url: src })
        if (cancelled) return void opened.destroy()
        const sizes = await Promise.all(
          Array.from({ length: opened.numPages }, async (_, i) => {
            const vp = (await opened.getPage(i + 1)).getViewport({ scale: 1 })
            return vp.height / vp.width
          }),
        )
        if (cancelled) return void opened.destroy()
        docRef.current = opened
        setDoc(opened)
        setRatios(sizes)
        setPageCount(opened.numPages)
        setLoadState('ready')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    })()
    return () => {
      cancelled = true
      void docRef.current?.destroy()
      docRef.current = null
    }
  }, [src])

  // Fit to width: track the page column's width.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setWidth(Math.floor(entry.contentRect.width)))
    })
    observer.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // "Page n of N" follows scrolling.
  useEffect(() => {
    if (state !== 'ready' || typeof IntersectionObserver === 'undefined') return
    const visible = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(Number((e.target as HTMLElement).dataset.page), e.intersectionRatio)
        const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]
        if (best && best[1] > 0) setCurrent(best[0])
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    pageRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [state, pageCount])

  const goTo = useCallback(
    (n: number) => {
      const target = Math.min(Math.max(1, n), pageCount)
      setCurrent(target)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      pageRefs.current[target - 1]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    },
    [pageCount],
  )

  const onKeyDown = (e: KeyboardEvent) => {
    if (state !== 'ready') return
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault()
      goTo(current + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      goTo(current - 1)
    }
  }

  const placeholderCount = Math.max(1, pageCount || 1)

  return (
    <figure className={cn('grid min-w-0 gap-3', className)} aria-label={title}>
      <PdfToolbar
        title={title}
        label={state === 'ready' ? `Page ${current} of ${pageCount}` : pageCount ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : 'PDF'}
        ready={state === 'ready'}
        canPrev={current > 1}
        canNext={current < pageCount}
        onPrev={() => goTo(current - 1)}
        onNext={() => goTo(current + 1)}
        onKeyDown={onKeyDown}
        href={downloadHref ?? src}
        download={Boolean(downloadHref)}
      />

      <div ref={rootRef} className="grid min-w-0 gap-3">
        {state === 'error' ? (
          <div className="grid place-items-center gap-3 rounded-dialog border border-border bg-canvas px-6 py-12 text-center" role="status">
            <FileText aria-hidden="true" className="size-5 text-text-tertiary" />
            <p className="text-body text-text">Can&apos;t display the PDF here.</p>
            <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-body font-medium text-accent hover:text-accent-hover">
              Open it in a new tab
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        ) : state === 'ready' && doc ? (
          Array.from({ length: pageCount }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                pageRefs.current[i] = el
              }}
              data-page={i + 1}
              className="scroll-mt-20"
            >
              <PdfPageCanvas doc={doc} page={i + 1} width={width} ratio={ratios[i] ?? LETTER_RATIO} label={`${title}, page ${i + 1} of ${pageCount}`} />
            </div>
          ))
        ) : (
          <PdfPlaceholderPages count={placeholderCount} thumbnailSrc={thumbnailSrc} loading priority={priority} />
        )}
      </div>
    </figure>
  )
}

function PdfPageCanvas({ doc, page, width, ratio, label }: { doc: PdfDocument; page: number; width: number; ratio: number; label: string }) {
  // Decks are at most 5 pages, so every page renders as soon as the document is open.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderedWidth, setRenderedWidth] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (width <= 0) return
    let task: { promise: Promise<void>; cancel(): void } | null = null
    let cancelled = false
    ;(async () => {
      try {
        const pdfPage = await doc.getPage(page)
        const base = pdfPage.getViewport({ scale: 1 })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        let scale = (width / base.width) * dpr
        if (base.width * scale * base.height * scale > MAX_CANVAS_PIXELS) scale = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height))
        const viewport = pdfPage.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        // Draw off-screen first so a resize never flashes a blank page.
        const scratch = document.createElement('canvas')
        scratch.width = Math.floor(viewport.width)
        scratch.height = Math.floor(viewport.height)
        task = pdfPage.render({ canvas: scratch, viewport })
        await task.promise
        if (cancelled) return
        canvas.width = scratch.width
        canvas.height = scratch.height
        canvas.getContext('2d')?.drawImage(scratch, 0, 0)
        setRenderedWidth(width)
      } catch (e) {
        if (!cancelled && !(e instanceof Error && e.name === 'RenderingCancelledException')) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page, width])

  return (
    <div className="relative overflow-hidden rounded-dialog border border-border bg-white" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvasRef} role="img" aria-label={label} className={cn('block size-full', renderedWidth === 0 && 'invisible')} />
      {renderedWidth === 0 ? (
        failed ? (
          <p className="absolute inset-0 grid place-items-center px-4 text-center text-body text-text-secondary">Can&apos;t display page {page}.</p>
        ) : (
          <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-muted" />
        )
      ) : null}
    </div>
  )
}
