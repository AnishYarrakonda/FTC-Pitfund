import 'server-only'

import { desc, eq, inArray, sql } from 'drizzle-orm'

import { firstApiSeason } from '@/lib/shared/season'
import { indexTeams, searchTeams, type DirectoryTeam, type IndexedTeam } from '@/lib/shared/team-search'

import { getDb } from './db'
import { env } from './env'
import { ftcTeamCache, teams } from './schema'

/*
 * The FIRST team directory: every FTC team FIRST lists, copied into ftc_team_cache so the team
 * setup page can search it as a coach types (by number, name or city) without one API call per
 * keystroke. The weekly cron job (lib/server/jobs.ts) and `npm run ftc:sync` refresh it; a team
 * FIRST lists but the copy missed is still found by number through lookupFtcTeam.
 */

const FIRST_API_BASE = 'https://ftc-api.firstinspires.org/v2.0'
const PAGE_TIMEOUT_MS = 20_000
const WRITE_BATCH = 1000
/** Fewer rows than this means the directory has not been synced (FIRST lists more than 10,000). */
export const MIN_DIRECTORY_SIZE = 1000

type Fetch = typeof fetch

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function toRow(team: Record<string, unknown>) {
  const number = Number(team.teamNumber)
  const short = clean(team.nameShort)
  const full = clean(team.nameFull)
  if (!Number.isInteger(number) || number <= 0 || !(short ?? full)) return null
  return {
    number,
    name: short ?? full ?? `Team ${number}`,
    fullName: short && full && short !== full ? full : null,
    city: clean(team.city),
    state: clean(team.stateProv),
    country: clean(team.country),
  }
}

async function fetchPage(season: number, page: number, authorization: string, fetchImpl: Fetch) {
  const res = await fetchImpl(`${FIRST_API_BASE}/${season}/teams?page=${page}`, {
    headers: { Authorization: authorization, Accept: 'application/json' },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`FIRST API responded ${res.status} for page ${page}`)
  const json = (await res.json()) as { teams?: Array<Record<string, unknown>>; pageTotal?: number }
  return { teams: Array.isArray(json.teams) ? json.teams : [], pageTotal: Number(json.pageTotal) || 1 }
}

/** Copy every team FIRST lists for the season into the cache. Throws when FIRST can't be reached. */
export async function syncFtcDirectory(options: { fetch?: Fetch; now?: Date; season?: number; credentials?: { username: string; token: string } } = {}) {
  const username = options.credentials?.username ?? env().FIRST_API_USERNAME
  const token = options.credentials?.token ?? env().FIRST_API_TOKEN
  if (!username || !token) throw new Error('FIRST API credentials are not configured')
  const authorization = 'Basic ' + Buffer.from(`${username}:${token}`).toString('base64')
  const fetchImpl = options.fetch ?? fetch
  const now = options.now ?? new Date()
  const season = options.season ?? firstApiSeason(now)

  const rows: NonNullable<ReturnType<typeof toRow>>[] = []
  let pageTotal = 1
  for (let page = 1; page <= pageTotal; page++) {
    const result = await fetchPage(season, page, authorization, fetchImpl)
    pageTotal = result.pageTotal
    for (const team of result.teams) {
      const row = toRow(team)
      if (row) rows.push(row)
    }
  }
  // A partial copy would hide real teams from the search: keep the old directory instead.
  if (rows.length < MIN_DIRECTORY_SIZE) throw new Error(`FIRST returned only ${rows.length} teams for ${season}`)

  const db = getDb()
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    const values = rows.slice(i, i + WRITE_BATCH).map((row) => ({ ...row, source: 'first' as const, fetchedAt: now }))
    await db
      .insert(ftcTeamCache)
      .values(values)
      .onConflictDoUpdate({
        target: ftcTeamCache.number,
        set: {
          name: sql`excluded.name`,
          fullName: sql`excluded.full_name`,
          city: sql`excluded.city`,
          state: sql`excluded.state`,
          country: sql`excluded.country`,
          source: sql`excluded.source`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      })
  }
  resetTeamIndex()
  return { season, teams: rows.length, pages: pageTotal }
}

let cached: { version: string; index: IndexedTeam[] } | null = null

export function resetTeamIndex() {
  cached = null
}

/** The tokenized directory, rebuilt only when the cache table changed (a sync, or a new lookup). */
async function loadIndex(): Promise<IndexedTeam[]> {
  const [stamp] = await getDb()
    .select({ n: sql<number>`count(*)::int`, latest: sql<string | null>`max(${ftcTeamCache.fetchedAt})::text` })
    .from(ftcTeamCache)
  const version = `${stamp?.n}:${stamp?.latest}`
  if (cached?.version === version) return cached.index
  const rows = await getDb()
    .select({
      number: ftcTeamCache.number,
      name: ftcTeamCache.name,
      fullName: ftcTeamCache.fullName,
      city: ftcTeamCache.city,
      state: ftcTeamCache.state,
      country: ftcTeamCache.country,
    })
    .from(ftcTeamCache)
    .orderBy(desc(ftcTeamCache.fetchedAt))
  const index = indexTeams(rows)
  cached = { version, index }
  return index
}

export type TeamSuggestion = DirectoryTeam & { onPitfund: boolean }

/** Up to six FIRST teams matching what the coach typed, marking the ones already on FTC Pitfund. */
export async function suggestTeams(query: string): Promise<TeamSuggestion[]> {
  const matches = searchTeams(await loadIndex(), query)
  if (matches.length === 0) return []
  const existing = await getDb()
    .select({ number: teams.number })
    .from(teams)
    .where(
      inArray(
        teams.number,
        matches.map((m) => m.number),
      ),
    )
  const onPitfund = new Set(existing.map((t) => t.number))
  return matches.map((m) => ({ ...m, onPitfund: onPitfund.has(m.number) }))
}

/** How many teams the directory holds (0 until the first sync). */
export async function directorySize(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(ftcTeamCache).where(eq(ftcTeamCache.source, 'first'))
  return row?.n ?? 0
}
