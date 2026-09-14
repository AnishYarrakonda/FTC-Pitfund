import 'server-only'

import { env } from './env'
import { createSupabaseAdminClient } from './supabase-admin'

/*
 * All file storage goes through this module so moving to Cloudflare R2 later is one file.
 *
 * public bucket:   teams/{teamId}/logo-{uuid}.webp · deck-{uuid}.pdf · thumb-{uuid}.webp
 *                  sponsors/{sponsorId}/logo-{uuid}.webp
 * staging bucket:  browser uploads land here via a signed upload URL; finalizeUpload (prompt 2)
 *                  verifies on the server and moves the object into `public`. The daily cron
 *                  deletes staging objects older than 24 h.
 */

export const BUCKETS = { public: 'public', staging: 'staging' } as const
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS]

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 5

export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `${env().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKETS.public}/${path}`
}

export function objectName(prefix: string, kind: 'logo' | 'deck' | 'thumb', ext: 'webp' | 'pdf' | 'png') {
  return `${prefix}/${kind}-${crypto.randomUUID()}.${ext}`
}

export async function uploadObject(bucket: Bucket, path: string, body: ArrayBuffer | Uint8Array | Blob, contentType: string) {
  const { error } = await createSupabaseAdminClient()
    .storage.from(bucket)
    .upload(path, body, { contentType, upsert: true, cacheControl: '31536000' })
  if (error) throw new Error(`Storage upload failed for ${bucket}/${path}: ${error.message}`)
  return path
}

export async function createSignedUpload(path: string) {
  const { data, error } = await createSupabaseAdminClient().storage.from(BUCKETS.staging).createSignedUploadUrl(path)
  if (error || !data) throw new Error(`Couldn't create an upload URL: ${error?.message ?? 'unknown error'}`)
  return { path: data.path, token: data.token, signedUrl: data.signedUrl }
}

export async function downloadObject(bucket: Bucket, path: string): Promise<Uint8Array> {
  const { data, error } = await createSupabaseAdminClient().storage.from(bucket).download(path)
  if (error || !data) throw new Error(`Storage download failed for ${bucket}/${path}: ${error?.message ?? 'missing'}`)
  return new Uint8Array(await data.arrayBuffer())
}

/** Move a verified staging object into the public bucket. */
export async function promoteFromStaging(stagingPath: string, publicPath: string, contentType: string) {
  const bytes = await downloadObject(BUCKETS.staging, stagingPath)
  await uploadObject(BUCKETS.public, publicPath, bytes, contentType)
  await removeObjects(BUCKETS.staging, [stagingPath])
  return publicPath
}

export async function removeObjects(bucket: Bucket, paths: Array<string | null | undefined>) {
  const clean = paths.filter((p): p is string => Boolean(p))
  if (clean.length === 0) return
  const { error } = await createSupabaseAdminClient().storage.from(bucket).remove(clean)
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

/** Objects in `staging` older than `olderThanMs` (the cron cleans these up). */
export async function listStaleStagingObjects(olderThanMs: number, now = new Date()) {
  const client = createSupabaseAdminClient().storage.from(BUCKETS.staging)
  const stale: string[] = []
  const walk = async (prefix: string) => {
    const { data, error } = await client.list(prefix, { limit: 1000 })
    if (error) throw new Error(`Storage list failed: ${error.message}`)
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (!item.id) await walk(path)
      else if (item.created_at && now.getTime() - new Date(item.created_at).getTime() > olderThanMs) stale.push(path)
    }
  }
  await walk('')
  return stale
}
