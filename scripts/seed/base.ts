import { sql } from 'drizzle-orm'

import { getDb } from '@/lib/server/db'
import { users } from '@/lib/server/schema'
import { BUCKETS, removeObjects, uploadObject } from '@/lib/server/storage'
import { createSupabaseAdminClient } from '@/lib/server/supabase-admin'
import { PERSONA_DOMAIN } from '@/lib/shared/personas'

import { generateDeckPdf, generateDeckThumbnail, generateLogo } from './assets'

export type SeedUser = { key: string; email: string; name: string; isAdmin?: boolean; jobTitle?: string; phone?: string }

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR

export function ago(now: Date, ms: number) {
  return new Date(now.getTime() - ms)
}

const APP_TABLES = [
  'audit_events',
  'notifications',
  'email_outbox',
  'reports',
  'invites',
  'pitches',
  'team_join_requests',
  'team_members',
  'sponsor_members',
  'teams',
  'sponsors',
  'ftc_team_cache',
  'cron_runs',
  'users',
]

/** Wipe every app table and both storage buckets. Auth users are reconciled separately. */
export async function wipeAppData() {
  await getDb().execute(sql.raw(`truncate table ${APP_TABLES.map((t) => `public.${t}`).join(', ')} cascade`))
  const admin = createSupabaseAdminClient()
  for (const bucket of [BUCKETS.public, BUCKETS.staging]) {
    const paths: string[] = []
    const walk = async (prefix: string) => {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
      if (error) throw new Error(`List ${bucket}: ${error.message}`)
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.id) paths.push(path)
        else await walk(path)
      }
    }
    await walk('')
    for (let i = 0; i < paths.length; i += 500) await removeObjects(bucket, paths.slice(i, i + 500))
  }
}

/**
 * Make the auth users match `wanted` exactly within the test domain: create missing ones,
 * delete stale ones (e.g. from E2E runs). Ids of existing users are kept, so persona sessions
 * survive a reseed. Returns email → id.
 */
export async function reconcileAuthUsers(wanted: SeedUser[]): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient()
  const existing = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id)
    if (data.users.length < 1000) break
  }

  const wantedEmails = new Set(wanted.map((u) => u.email.toLowerCase()))
  for (const [email, id] of existing) {
    if (email.endsWith(`@${PERSONA_DOMAIN}`) && !wantedEmails.has(email)) {
      await admin.auth.admin.deleteUser(id)
      existing.delete(email)
    }
  }

  const ids = new Map<string, string>()
  for (const user of wanted) {
    const email = user.email.toLowerCase()
    let id = existing.get(email)
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: user.name },
      })
      if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`)
      id = data.user.id
    }
    ids.set(email, id)
  }
  return ids
}

export async function insertUsers(seedUsers: SeedUser[], ids: Map<string, string>, now: Date) {
  if (seedUsers.length === 0) return
  await getDb()
    .insert(users)
    .values(
      seedUsers.map((u) => ({
        id: ids.get(u.email.toLowerCase())!,
        email: u.email.toLowerCase(),
        name: u.name,
        isAdmin: Boolean(u.isAdmin),
        jobTitle: u.jobTitle ?? null,
        phone: u.phone ?? null,
        acceptedTermsAt: ago(now, 40 * DAY),
        createdAt: ago(now, 40 * DAY),
      })),
    )
}

export async function uploadTeamAssets(
  teamId: string,
  logo: { color: string; shape: Parameters<typeof generateLogo>[1] } | null,
  deck: Parameters<typeof generateDeckPdf>[0] | null,
) {
  let logoPath: string | null = null
  if (logo) {
    logoPath = `teams/${teamId}/logo-${crypto.randomUUID()}.png`
    await uploadObject(BUCKETS.public, logoPath, generateLogo(logo.color, logo.shape), 'image/png')
  }
  if (!deck) return { logoPath, pdf: null }
  const pdfBytes = await generateDeckPdf(deck)
  const pdfPath = `teams/${teamId}/deck-${crypto.randomUUID()}.pdf`
  const thumbPath = `teams/${teamId}/thumb-${crypto.randomUUID()}.png`
  await uploadObject(BUCKETS.public, pdfPath, pdfBytes, 'application/pdf')
  await uploadObject(BUCKETS.public, thumbPath, generateDeckThumbnail(deck.color), 'image/png')
  return { logoPath, pdf: { path: pdfPath, bytes: pdfBytes.byteLength, pages: deck.pages, thumbPath } }
}

export async function uploadSponsorLogo(sponsorId: string, color: string, shape: Parameters<typeof generateLogo>[1]) {
  const path = `sponsors/${sponsorId}/logo-${crypto.randomUUID()}.png`
  await uploadObject(BUCKETS.public, path, generateLogo(color, shape), 'image/png')
  return path
}

/** An unbroken string of `length` characters (the layout torture test). */
export function unbroken(length: number, seed = 'Pitfund') {
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length)
}
