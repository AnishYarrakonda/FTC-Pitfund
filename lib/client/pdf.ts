'use client'

import { DECK_MESSAGES, MAX_PDF_BYTES, MAX_PDF_PAGES, THUMB_WIDTH_PX } from '@/lib/shared/team'

import { encodeImage } from './upload'

/*
 * pdf.js in the browser, loaded only when needed (~400 KB is never in a route bundle): the deck
 * pre-check before any network (type, size, page count), the page-1 thumbnail, and the viewer.
 */

type PdfPage = {
  getViewport(opts: { scale: number }): { width: number; height: number }
  render(opts: { canvas: HTMLCanvasElement; viewport: { width: number; height: number } }): { promise: Promise<void>; cancel(): void }
  cleanup?(): void
}
export type PdfDocument = { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> }

type PdfJs = typeof import('pdfjs-dist') // eslint-disable-line @typescript-eslint/consistent-type-imports -- a type-only import would pull pdf.js into the bundle graph

let loader: Promise<PdfJs> | null = null

function loadPdfjs() {
  loader ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return pdfjs
  })
  return loader
}

export async function openPdf(source: { url: string } | { data: Uint8Array }): Promise<PdfDocument> {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument('url' in source ? { url: source.url } : { data: source.data })
  const doc = await task.promise
  // pdf.js 6: the loading task, not the document proxy, owns destroy().
  return { numPages: doc.numPages, getPage: (n) => doc.getPage(n) as unknown as Promise<PdfPage>, destroy: () => task.destroy() }
}

export class DeckCheckError extends Error {}

async function hasPdfMagic(file: File) {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  return new TextDecoder('latin1').decode(head).includes('%PDF-')
}

/**
 * Check a chosen file the way the server will, before uploading: PDF, ≤10 MB, ≤5 pages. Returns
 * the page count and a ~1200 px page-1 thumbnail. Throws DeckCheckError with the exact message.
 */
export async function inspectDeck(file: File): Promise<{ pages: number; thumbnail: Blob }> {
  if (file.size > MAX_PDF_BYTES) throw new DeckCheckError(DECK_MESSAGES.tooLarge(file.size))
  if (file.size === 0 || !(await hasPdfMagic(file))) throw new DeckCheckError(DECK_MESSAGES.notPdf)

  let doc: PdfDocument
  try {
    doc = await openPdf({ data: new Uint8Array(await file.arrayBuffer()) })
  } catch {
    throw new DeckCheckError(DECK_MESSAGES.notPdf)
  }
  try {
    if (doc.numPages < 1) throw new DeckCheckError(DECK_MESSAGES.empty)
    if (doc.numPages > MAX_PDF_PAGES) throw new DeckCheckError(DECK_MESSAGES.tooManyPages(doc.numPages))
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: THUMB_WIDTH_PX / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    const thumbnail = await encodeImage(canvas, 1_500_000)
    return { pages: doc.numPages, thumbnail }
  } catch (e) {
    if (e instanceof DeckCheckError) throw e
    throw new DeckCheckError(DECK_MESSAGES.notPdf)
  } finally {
    void doc.destroy()
  }
}
