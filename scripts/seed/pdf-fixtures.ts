import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { generateDeckPdf } from './assets'

/*
 * PDF files for upload tests, written to tests/.fixtures (gitignored) on every seed:
 *   deck-3-pages.pdf   a valid deck (~2 MB, so upload progress is visible)
 *   deck-8-pages.pdf   rejected: more than 5 pages
 *   deck-corrupt.pdf   rejected: starts like a PDF but isn't one
 *   not-a-pdf.pdf      rejected: an HTML file renamed to .pdf
 */
const PDF_FIXTURES_DIR = path.resolve(process.cwd(), 'tests/.fixtures')

export async function writePdfFixtures() {
  mkdirSync(PDF_FIXTURES_DIR, { recursive: true })
  const deck = { teamName: 'Upload Test', teamNumber: 31579, location: 'Austin, TX', color: '#1F6F5C' }
  const valid = await generateDeckPdf({ ...deck, pages: 3, noiseSide: 820 })
  writeFileSync(path.join(PDF_FIXTURES_DIR, 'deck-3-pages.pdf'), valid)
  writeFileSync(path.join(PDF_FIXTURES_DIR, 'deck-8-pages.pdf'), await generateDeckPdf({ ...deck, pages: 8 }))
  // A real PDF header followed by garbage: passes the magic-byte check, fails parsing.
  const corrupt = new Uint8Array(64_000)
  corrupt.set(valid.subarray(0, 16))
  for (let i = 16; i < corrupt.length; i++) corrupt[i] = (i * 7919) % 251
  writeFileSync(path.join(PDF_FIXTURES_DIR, 'deck-corrupt.pdf'), corrupt)
  writeFileSync(path.join(PDF_FIXTURES_DIR, 'not-a-pdf.pdf'), '<!doctype html><title>Not a PDF</title>')
}
