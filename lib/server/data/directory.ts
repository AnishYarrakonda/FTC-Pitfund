import 'server-only'

import { and, asc, count, desc, eq, sql, type SQL } from 'drizzle-orm'
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
  verified: boolean
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
    // The id is cast to uuid in SQL and Postgres refuses NUL in text: a value of the wrong shape must start over, not throw.
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((p) => typeof p === 'string' && !p.includes('\u0000')) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed[1])) return parsed as Cursor
  } catch {
    // An edited or stale cursor just starts from the beginning.
  }
  return null
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * How close a match has to be before it counts.
 *
 * This is word_similarity, not similarity: it scores the query against the best-matching run of
 * words inside the name, so a short query isn't punished for the rest of a long company name
 * ("keytsone" against "BioBuzz Foundation" scores 0.38 this way and 0.15 the other).
 * Measured against real misspellings in tests/unit/directory-and-public.test.ts — 0.3 accepts a
 * dropped or transposed letter and rejects words that merely share a few trigrams.
 */
const SIMILARITY_THRESHOLD = 0.3

/** While searching, relevance order replaces alphabetical order, so the pager can't be used. */
export const SEARCH_RESULT_LIMIT = 50

export type PitchFilter = 'all' | 'not_pitched' | 'in_progress' | 'pitched'

export type DirectoryQuery = {
  q: string
  after: string | null
  before: string | null
  /** Sponsor ids this team has a pitch with, split by what state it is in. Empty when unfiltered. */
  filter?: { kind: Exclude<PitchFilter, 'all'>; ids: string[] }
}

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
  const q = params.q.replaceAll('\u0000', '').trim().toLowerCase().slice(0, 100)

  // Searching is fuzzy and ranked: company names are easy to mistype ("brightlne", "keystone
  // robotic"), and an exact substring match turns one wrong letter into an empty page. A prefix
  // match still wins, then trigram similarity, so the closest name is always first.
  const similarity = sql<number>`word_similarity(${q}, lower(${sponsors.name}))`
  const prefix = sql<boolean>`lower(${sponsors.name}) like ${`${escapeLike(q)}%`}`
  if (q) conditions.push(sql`(lower(${sponsors.name}) like ${`%${escapeLike(q)}%`} or ${similarity} >= ${SIMILARITY_THRESHOLD})`)

  const filter = params.filter
  if (filter) {
    if (filter.ids.length === 0) {
      // "Already pitched" with nothing pitched is an empty page, not every company.
      if (filter.kind !== 'not_pitched') return { items: [], nextCursor: null, prevCursor: null }
    } else {
      const ids = sql`(${sql.join(filter.ids.map((id) => sql`${id}::uuid`), sql`, `)})`
      conditions.push(filter.kind === 'not_pitched' ? sql`${sponsors.id} not in ${ids}` : sql`${sponsors.id} in ${ids}`)
    }
  }

  const paged = !q
  if (paged && after) conditions.push(sql`${key} > (${after[0]}, ${after[1]}::uuid)`)
  if (paged && before) conditions.push(sql`${key} < (${before[0]}, ${before[1]}::uuid)`)

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
    .orderBy(
      ...(q
        ? [desc(prefix), desc(similarity), asc(sql`lower(${sponsors.name})`), asc(sponsors.id)]
        : before
          ? [desc(sql`lower(${sponsors.name})`), desc(sponsors.id)]
          : [asc(sql`lower(${sponsors.name})`), asc(sponsors.id)]),
    )
    .limit(q ? SEARCH_RESULT_LIMIT : DIRECTORY_PAGE_SIZE + 1)

  if (q) {
    return { items: rows.map(({ logoPath, ...rest }) => ({ ...rest, logoUrl: publicUrl(logoPath), verified: true })), nextCursor: null, prevCursor: null }
  }

  const more = rows.length > DIRECTORY_PAGE_SIZE
  const page = rows.slice(0, DIRECTORY_PAGE_SIZE)
  if (before) page.reverse()
  const items = page.map(({ logoPath, ...rest }) => ({ ...rest, logoUrl: publicUrl(logoPath), verified: true }))
  const first = items[0]
  const last = items[items.length - 1]
  return {
    items,
    nextCursor: last && (before ? true : more) ? encodeCursor(last) : null,
    prevCursor: first && (before ? more : Boolean(after)) ? encodeCursor(first) : null,
  }
}

/** How many approved companies there are, for the "All" chip. */
export async function countApprovedSponsors(): Promise<number> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.sponsors)
  const [row] = await getDb().select({ n: count() }).from(sponsors).where(eq(sponsors.status, 'approved'))
  return Number(row?.n ?? 0)
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
    verified: true,
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
