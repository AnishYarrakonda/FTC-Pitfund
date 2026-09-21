'use client'

import { ExternalLink, FileText } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'

import { openPdf, type PdfDocument } from '@/lib/client/pdf'
import { cn } from '@/lib/shared/cn'

import { LETTER_RATIO, PdfPlaceholderPages } from './pdf-viewer'

/** iOS Safari refuses canvases much past ~16 M pixels; stay well under. */
const MAX_CANVAS_PIXELS = 12_000_000

/*
 * Pages are rasterized at this multiple of their CSS size, at least. Rendering at exactly
 * devicePixelRatio is what a photo needs, but a deck is vector text: pdf.js has no hinting or
 * subpixel positioning to fall back on, so at 1× on a non-Retina monitor glyph stems land between
 * pixels and the whole page reads as soft. Two device pixels per CSS pixel is the floor that makes
 * 9-11 pt body copy legible; a Retina screen already asks for more and keeps its own ratio.
 */
const MIN_RENDER_SCALE = 2
/** Above 3× the file size and decode cost stop buying visible sharpness. */
const MAX_RENDER_SCALE = 3

export type PdfPagesProps = {
  src: string
  title: string
  pages?: number | null
  thumbnailSrc?: string | null
  priority?: boolean
  /** The page column, measured to fit pages to its width. */
  containerRef: RefObject<HTMLDivElement | null>
  /** One element per page, for scrolling to a page. */
  pageRefs: RefObject<Array<HTMLDivElement | null>>
  onReady: (pageCount: number) => void
  onVisiblePage: (page: number) => void
}

/**
 * The PDF pages, loaded by ./pdf-viewer.tsx (which keeps the figure and toolbar) when the viewer
 * nears the viewport or the reader asks for it, with pdf.js right behind it. Every page renders to a
 * canvas (not an iframe, so it works on iOS Safari), fit to the column's width, with a skeleton
 * until it's drawn.
 */
export default function PdfPages({ src, title, pages, thumbnailSrc, priority, containerRef, pageRefs, onReady, onVisiblePage }: PdfPagesProps) {
  const docRef = useRef<PdfDocument | null>(null)
  const [doc, setDoc] = useState<PdfDocument | null>(null)
  const [failed, setFailed] = useState(false)
  const [ratios, setRatios] = useState<number[]>([])
  const [width, setWidth] = useState(0)
  const pageCount = doc?.numPages ?? 0

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
        setRatios(sizes)
        setDoc(opened)
        onReady(opened.numPages)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      void docRef.current?.destroy()
      docRef.current = null
    }
  }, [src, onReady])

  // Fit to width: track the page column's width.
  useEffect(() => {
    const el = containerRef.current
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
  }, [containerRef])

  // "Page n of N" follows scrolling.
  useEffect(() => {
    if (!doc || typeof IntersectionObserver === 'undefined') return
    const visible = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(Number((e.target as HTMLElement).dataset.page), e.intersectionRatio)
        const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]
        if (best && best[1] > 0) onVisiblePage(best[0])
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    pageRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [doc, pageRefs, onVisiblePage])

  if (failed) {
    return (
      <div className="grid place-items-center gap-3 rounded-dialog border border-border bg-canvas px-6 py-12 text-center" role="status">
        <FileText aria-hidden="true" className="size-5 text-text-tertiary" />
        <p className="text-body text-text">Can&apos;t display the PDF here.</p>
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-body font-medium text-accent hover:text-accent-hover">
          Open it in a new tab
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    )
  }

  if (!doc) return <PdfPlaceholderPages count={Math.max(1, pages ?? 1)} thumbnailSrc={thumbnailSrc} title={title} loading priority={priority} />

  return Array.from({ length: pageCount }, (_, i) => (
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
        const dpr = Math.min(Math.max(window.devicePixelRatio || 1, MIN_RENDER_SCALE), MAX_RENDER_SCALE)
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
