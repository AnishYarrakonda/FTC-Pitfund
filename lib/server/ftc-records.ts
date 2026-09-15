import 'server-only'

import { eq } from 'drizzle-orm'

import { firstApiSeason } from '@/lib/shared/season'

import { getDb } from './db'
import { env } from './env'
import { ftcTeamCache } from './schema'

/*
 * FTC team lookup for the coach first-run (plan §3.2 "Coach first run").
 *
 * Order: fresh cache (30 days) → official FIRST Events API (when credentials exist) →
 * FTCScout community API → stale cache → give up. Each network source has a 4 s timeout and
 * nothing here throws: every failure degrades to `unavailable`, which sends the coach down
 * the manual-entry path with record_status = 'unchecked'.
 *
 * Ported from legacy-v1 lib/first-api.ts + lib/ftc-roster.ts. Note FTCScout's schema nests
 * city/state/country under `location { }`; the old flat selection silently returned nothing.
 */

type FtcRecord = {
  number: number
  name: string
  city: string | null
  state: string | null
  country: string | null
}

type FtcSource = 'first' | 'ftcscout' | 'cache'

export type FtcLookup =
  | { status: 'found'; record: FtcRecord; source: FtcSource }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: string }

type SourceResult =
  | { status: 'found'; record: FtcRecord }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: string }

type Fetch = typeof fetch

const FIRST_API_BASE = 'https://ftc-api.firstinspires.org/v2.0'
const FTCSCOUT_URL = 'https://api.ftcscout.org/graphql'
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const TIMEOUT_MS = 4000

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

async function firstApiSeasonLookup(
  number: number,
  season: number,
  authorization: string,
  fetchImpl: Fetch,
): Promise<SourceResult> {
  try {
    const res = await fetchImpl(`${FIRST_API_BASE}/${season}/teams?teamNumber=${number}`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // The FIRST API answers 400/404 for a team number it has never seen in that season.
    if (res.status === 404 || res.status === 400) return { status: 'not_found' }
    if (!res.ok) return { status: 'unavailable', reason: `FIRST API responded ${res.status}` }
    const json = (await res.json()) as { teams?: Array<Record<string, unknown>> }
    const team = Array.isArray(json?.teams) ? json.teams[0] : undefined
    if (!team) return { status: 'not_found' }
    return {
      status: 'found',
      record: {
        number,
        name: clean(team.nameShort) ?? clean(team.nameFull) ?? `Team ${number}`,
        city: clean(team.city),
        state: clean(team.stateProv),
        country: clean(team.country),
      },
    }
  } catch (e) {
    return { status: 'unavailable', reason: e instanceof Error ? e.message : 'FIRST API request failed' }
  }
}

export async function fetchFromFirstApi(
  number: number,
  options: { fetch?: Fetch; now?: Date; username?: string; token?: string } = {},
): Promise<SourceResult> {
  const username = options.username ?? env().FIRST_API_USERNAME
  const token = options.token ?? env().FIRST_API_TOKEN
  if (!username || !token) return { status: 'unavailable', reason: 'FIRST API credentials are not configured' }

  const authorization = 'Basic ' + Buffer.from(`${username}:${token}`).toString('base64')
  const fetchImpl = options.fetch ?? fetch
  const season = firstApiSeason(options.now)
  const current = await firstApiSeasonLookup(number, season, authorization, fetchImpl)
  if (current.status !== 'not_found') return current
  // A team that hasn't re-registered yet is still a real team: check the previous season.
  return firstApiSeasonLookup(number, season - 1, authorization, fetchImpl)
}

export async function fetchFromFtcScout(number: number, options: { fetch?: Fetch } = {}): Promise<SourceResult> {
  const query = `query TeamByNumber($number: Int!) {
    teamByNumber(number: $number) { number name location { city state country } }
  }`
  try {
    const res = await (options.fetch ?? fetch)(FTCSCOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { number } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { status: 'unavailable', reason: `FTCScout responded ${res.status}` }
    const json = (await res.json()) as {
      errors?: unknown[]
      data?: { teamByNumber?: { number: number; name: string; location?: Record<string, unknown> } | null }
    }
    if (json.errors?.length) return { status: 'unavailable', reason: 'FTCScout returned errors' }
    const team = json.data?.teamByNumber
    if (!team) return { status: 'not_found' }
    return {
      status: 'found',
      record: {
        number,
        name: clean(team.name) ?? `Team ${number}`,
        city: clean(team.location?.city),
        state: clean(team.location?.state),
        country: clean(team.location?.country),
      },
    }
  } catch (e) {
    return { status: 'unavailable', reason: e instanceof Error ? e.message : 'FTCScout request failed' }
  }
}

async function writeCache(record: FtcRecord, source: 'first' | 'ftcscout', now: Date) {
  const values = { ...record, source, fetchedAt: now }
  await getDb()
    .insert(ftcTeamCache)
    .values(values)
    .onConflictDoUpdate({ target: ftcTeamCache.number, set: values })
}

/** Look up an FTC team number. Never throws. */
export async function lookupFtcTeam(
  number: number,
  options: { fetch?: Fetch; now?: Date; firstCredentials?: { username: string; token: string } | null } = {},
): Promise<FtcLookup> {
  const now = options.now ?? new Date()
  if (!Number.isInteger(number) || number <= 0 || number > 999999) return { status: 'not_found' }

  let cached: typeof ftcTeamCache.$inferSelect | undefined
  try {
    ;[cached] = await getDb().select().from(ftcTeamCache).where(eq(ftcTeamCache.number, number)).limit(1)
  } catch {
    cached = undefined
  }
  const toRecord = (row: typeof ftcTeamCache.$inferSelect): FtcRecord => ({
    number: row.number,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
  })
  if (cached && now.getTime() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return { status: 'found', record: toRecord(cached), source: 'cache' }
  }

  const credentials =
    options.firstCredentials === null
      ? { username: '', token: '' }
      : (options.firstCredentials ?? { username: env().FIRST_API_USERNAME ?? '', token: env().FIRST_API_TOKEN ?? '' })

  const reasons: string[] = []
  const sources: Array<['first' | 'ftcscout', () => Promise<SourceResult>]> = [
    ['first', () => fetchFromFirstApi(number, { fetch: options.fetch, now, ...credentials })],
    ['ftcscout', () => fetchFromFtcScout(number, { fetch: options.fetch })],
  ]

  for (const [source, run] of sources) {
    const result = await run()
    if (result.status === 'found') {
      await writeCache(result.record, source, now).catch(() => {})
      return { status: 'found', record: result.record, source }
    }
    // An authoritative "no such team" ends the search; an outage falls through.
    if (result.status === 'not_found') return cached ? { status: 'found', record: toRecord(cached), source: 'cache' } : result
    reasons.push(`${source}: ${result.reason}`)
  }

  if (cached) return { status: 'found', record: toRecord(cached), source: 'cache' }
  return { status: 'unavailable', reason: reasons.join('; ') }
}
