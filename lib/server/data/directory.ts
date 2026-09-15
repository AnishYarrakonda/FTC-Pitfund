import 'server-only'

import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { questionsFor, type Question } from '@/lib/shared/questions'
import { pitchSeason } from '@/lib/shared/season'
import type { PitchStatus, SupportType } from '@/lib/shared/types'

import type { TeamViewer } from '../authz'
import { TAGS } from '../cache-tags'
import { getDb } from '../db'
import { pitches, sponsors } from '../schema'
import { publicUrl } from '../storage'

/*
 * The coach-facing sponsor directory (plan §2). Only `approved` companies ever leave this module.
 * The list and company profiles are cached by tag; each team's status with each company is a
 * separate uncached query merged in by the page.
 */

export const DIRECTORY_PAGE_SIZE = 25

type DirectoryItem = {
  id: string
  name: string
  logoUrl: string | null
  city: string | null
  state: string | null
  region: string | null
  about: string | null
  supportTypes: SupportType[]
}

export type DirectoryPage = { items: DirectoryItem[]; nextCursor: string | null; prevCursor: string | null }

type Cursor = [string, string]

function encodeCursor(item: { name: string; id: string }) {
  return Buffer.from(JSON.stringify([item.name.toLowerCase(), item.id])).toString('base64url')
}

function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((p) => typeof p === 'string')) return parsed as Cursor
  } catch {
    // An edited or stale cursor just starts from the beginning.
  }
  return null
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

export type DirectoryQuery = { q: string; type: SupportType | null; after: string | null; before: string | null }

export async function listDirectory(params: DirectoryQuery): Promise<DirectoryPage> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.sponsors)
  return queryDirectory(params)
}

/** The uncached query behind listDirectory (tests call it directly). */
export async function queryDirectory(params: DirectoryQuery): Promise<DirectoryPage> {
  const after = decodeCursor(params.after)
  const before = after ? null : decodeCursor(params.before)
  const key = sql`(lower(${sponsors.name}), ${sponsors.id})`
  const conditions: SQL[] = [eq(sponsors.status, 'approved')]
  const q = params.q.trim().toLowerCase().slice(0, 100)
  if (q) conditions.push(sql`lower(${sponsors.name}) like ${`%${escapeLike(q)}%`}`)
  if (params.type) conditions.push(sql`${params.type}::support_type = any(${sponsors.supportTypes})`)
  if (after) conditions.push(sql`${key} > (${after[0]}, ${after[1]}::uuid)`)
  if (before) conditions.push(sql`${key} < (${before[0]}, ${before[1]}::uuid)`)

  const rows = await getDb()
    .select({
      id: sponsors.id,
      name: sponsors.name,
      logoPath: sponsors.logoPath,
      city: sponsors.city,
      state: sponsors.state,
      region: sponsors.region,
      about: sponsors.about,
      supportTypes: sponsors.supportTypes,
    })
    .from(sponsors)
    .where(and(...conditions))
    .orderBy(...(before ? [desc(sql`lower(${sponsors.name})`), desc(sponsors.id)] : [asc(sql`lower(${sponsors.name})`), asc(sponsors.id)]))
    .limit(DIRECTORY_PAGE_SIZE + 1)

  const more = rows.length > DIRECTORY_PAGE_SIZE
  const page = rows.slice(0, DIRECTORY_PAGE_SIZE)
  if (before) page.reverse()
  const items = page.map(({ logoPath, ...rest }) => ({ ...rest, logoUrl: publicUrl(logoPath) }))
  const first = items[0]
  const last = items[items.length - 1]
  return {
    items,
    nextCursor: last && (before ? true : more) ? encodeCursor(last) : null,
    prevCursor: first && (before ? more : Boolean(after)) ? encodeCursor(first) : null,
  }
}

export type DirectorySponsor = DirectoryItem & { website: string; questions: Question[]; usesDefaultQuestions: boolean }

/** An approved company's profile, with the questions a pitch to it must answer. */
export async function getDirectorySponsor(id: string): Promise<DirectorySponsor | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.sponsors, TAGS.sponsor(id))
  return queryDirectorySponsor(id)
}

/** The uncached query behind getDirectorySponsor (tests and actions call it directly). */
export async function queryDirectorySponsor(id: string): Promise<DirectorySponsor | null> {
  const [row] = await getDb()
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.id, id), eq(sponsors.status, 'approved')))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    logoUrl: publicUrl(row.logoPath),
    city: row.city,
    state: row.state,
    region: row.region,
    about: row.about,
    supportTypes: row.supportTypes,
    questions: questionsFor({ name: row.name, questions: row.questions }),
    usesDefaultQuestions: row.questions.length === 0,
  }
}

/** This season's pitch (if any) for each company, for the directory status overlay. Uncached. */
export async function teamPitchesBySponsor(viewer: TeamViewer, now = new Date()): Promise<Record<string, { id: string; status: PitchStatus }>> {
  const rows = await getDb()
    .select({ id: pitches.id, sponsorId: pitches.sponsorId, status: pitches.status })
    .from(pitches)
    .where(and(eq(pitches.teamId, viewer.team.id), eq(pitches.season, pitchSeason(now)), sql`${pitches.status} <> 'withdrawn'`))
  return Object.fromEntries(rows.map((r) => [r.sponsorId, { id: r.id, status: r.status }]))
}
