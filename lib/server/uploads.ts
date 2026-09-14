import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { PDFDocument } from 'pdf-lib'

import { DECK_MESSAGES, MAX_IMAGE_UPLOAD_BYTES, MAX_PDF_BYTES, MAX_PDF_PAGES } from '@/lib/shared/team'

import { env } from './env'
import { AppError } from './result'
import { BUCKETS, createSignedUpload, downloadObject, removeObjects, uploadObject } from './storage'

/*
 * Server-side verification for browser uploads (plan §3.2 "PDF upload", §5 "Files").
 * The browser uploads straight to the private `staging` bucket with a signed URL; nothing it
 * sends is trusted. These helpers re-check the bytes and re-upload them with a content type
 * chosen here, so the public bucket only ever serves verified PDFs and raster images.
 * Shared by team decks/logos (prompt 2) and company logos (prompt 3).
 */

export type ImageKind = { ext: 'webp' | 'png' | 'jpg'; contentType: 'image/webp' | 'image/png' | 'image/jpeg' }

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b)

/** PDF files start with "%PDF-" (a few producers put junk first; the spec allows 1024 bytes). */
export function hasPdfMagic(bytes: Uint8Array) {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString('latin1')
  return head.includes('%PDF-')
}

export function imageKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: 'webp', contentType: 'image/webp' }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', contentType: 'image/png' }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: 'jpg', contentType: 'image/jpeg' }
  return null
}

/** Size, magic bytes and page count. Throws VALIDATION with the exact user-facing message. */
export async function verifyPdfBytes(bytes: Uint8Array): Promise<{ pages: number; bytes: number }> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new AppError('VALIDATION', DECK_MESSAGES.tooLarge(bytes.byteLength))
  if (bytes.byteLength === 0 || !hasPdfMagic(bytes)) throw new AppError('VALIDATION', DECK_MESSAGES.notPdf)
  let pages: number
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false })
    pages = doc.getPageCount()
  } catch {
    throw new AppError('VALIDATION', DECK_MESSAGES.notPdf)
  }
  if (pages < 1) throw new AppError('VALIDATION', DECK_MESSAGES.empty)
  if (pages > MAX_PDF_PAGES) throw new AppError('VALIDATION', DECK_MESSAGES.tooManyPages(pages))
  return { pages, bytes: bytes.byteLength }
}

export function verifyImageBytes(bytes: Uint8Array, what = 'image'): ImageKind {
  if (bytes.byteLength === 0) throw new AppError('VALIDATION', `That ${what} is empty.`)
  if (bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) throw new AppError('VALIDATION', `That ${what} is larger than 2 MB.`)
  const kind = imageKind(bytes)
  if (!kind) throw new AppError('VALIDATION', `That ${what} isn’t a PNG, JPEG or WebP image.`)
  return kind
}

/** Staging paths are always `{prefix}/upload-{uuid}.{ext}`; anything else is someone else's file. */
export function assertOwnStagingPath(path: string, prefix: string) {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/upload-[0-9a-f-]{36}\\.(pdf|webp|png|jpg)$`)
  if (!pattern.test(path)) throw new AppError('NOT_FOUND', 'That upload doesn’t exist or isn’t yours. Upload the file again.')
}

export async function createStagingUpload(prefix: string, ext: 'pdf' | 'webp' | 'png' | 'jpg') {
  return createSignedUpload(`${prefix}/upload-${crypto.randomUUID()}.${ext}`)
}

export async function readStaged(path: string) {
  try {
    return await downloadObject(BUCKETS.staging, path)
  } catch {
    throw new AppError('NOT_FOUND', 'We couldn’t find your upload. It may have expired. Upload the file again.')
  }
}

/** Upload verified bytes to the public bucket under a fresh unguessable name. */
export async function publishVerified(prefix: string, kind: 'logo' | 'deck' | 'thumb', bytes: Uint8Array, type: { ext: string; contentType: string }) {
  const path = `${prefix}/${kind}-${crypto.randomUUID()}.${type.ext}`
  await uploadObject(BUCKETS.public, path, bytes, type.contentType)
  return path
}

export async function discard(bucket: 'public' | 'staging', paths: Array<string | null | undefined>) {
  try {
    await removeObjects(bucket, paths)
  } catch (e) {
    // Leftovers are harmless: staging is cleaned daily, and public names are unguessable.
    console.warn('[uploads] cleanup failed', e instanceof Error ? e.message : e)
  }
}

// ─── Receipts ───────────────────────────────────────────────────────────────────────────
// The deck check and the deck save are two requests so the UI can show each stage honestly.
// The check hands back a signed receipt of what it verified; the save accepts nothing else.

export type Receipt = { scope: string; path: string; pages: number; bytes: number; exp: number }

function sign(payload: string) {
  return createHmac('sha256', env().SUPABASE_SECRET_KEY).update(`pitfund-upload:${payload}`).digest('base64url')
}

export function signReceipt(receipt: Omit<Receipt, 'exp'>, ttlMs = 30 * 60 * 1000, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...receipt, exp: now + ttlMs })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readReceipt(token: string, scope: string, now = Date.now()): Receipt {
  const invalid = new AppError('VALIDATION', 'Your upload check expired. Upload the file again.')
  const [payload, signature] = token.split('.')
  if (!payload || !signature) throw invalid
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw invalid
  let receipt: Receipt
  try {
    receipt = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Receipt
  } catch {
    throw invalid
  }
  if (receipt.scope !== scope) throw new AppError('NOT_FOUND', 'That upload doesn’t exist or isn’t yours. Upload the file again.')
  if (typeof receipt.exp !== 'number' || receipt.exp < now) throw invalid
  return receipt
}
