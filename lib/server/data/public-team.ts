import 'server-only'

import { and, asc, eq, isNull } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { TAGS } from '../cache-tags'
import { getDb } from '../db'
import { teams } from '../schema'
import { publicUrl } from '../storage'

/*
 * The public team page (/t/[number]) and its metadata. Cached per team and invalidated when the
 * team edits its profile, is verified or suspended. It selects only public columns: no member
 * names, emails or phones can reach this page.
 */

export type PublicTeam = {
  id: string
  number: number
  name: string
  location: string | null
  website: string | null
  instagram: string | null
  summary: string | null
  logoUrl: string | null
  /** Always true here — only approved teams have a public page — but outsiders don't know that. */
  verified: boolean
  deck: { url: string; downloadUrl: string; pages: number; thumbUrl: string | null; updatedAt: Date } | null
}

export async function getPublicTeam(number: number): Promise<PublicTeam | null> {
  'use cache'
  cacheLife('days')
  const team = await queryPublicTeam(number)
  cacheTag(TAGS.teams, TAGS.teamNumber(number), ...(team ? [TAGS.team(team.id)] : []))
  return team
}

/**
 * Every team that has a public page (the same rule as queryPublicTeam: not suspended), for
 * /sitemap.xml. Cached for hours; a new team appears on the next refresh.
 */
export async function listPublicTeamPages(): Promise<{ number: number; updatedAt: Date }[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(TAGS.teams)
  return getDb()
    .select({ number: teams.number, updatedAt: teams.updatedAt })
    .from(teams)
    .where(and(eq(teams.status, 'approved'), isNull(teams.suspendedAt)))
    .orderBy(asc(teams.number))
}

/** The uncached query behind getPublicTeam (tests call it directly). */
export async function queryPublicTeam(number: number): Promise<PublicTeam | null> {
  const [row] = await getDb()
    .select({
      id: teams.id,
      number: teams.number,
      name: teams.name,
      location: teams.location,
      website: teams.website,
      instagram: teams.instagram,
      summary: teams.summary,
      logoPath: teams.logoPath,
      pdfPath: teams.pdfPath,
      pdfPages: teams.pdfPages,
      pdfThumbPath: teams.pdfThumbPath,
      pdfUpdatedAt: teams.pdfUpdatedAt,
    })
    .from(teams)
    // Only an approved team has a public page: a draft or rejected one must not be reachable at a
    // guessable URL, or impersonating a team would still get you a page with that team's number on it.
    .where(and(eq(teams.number, number), eq(teams.status, 'approved'), isNull(teams.suspendedAt)))
    .limit(1)

  if (!row) return null

  const deckUrl = publicUrl(row.pdfPath)
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    location: row.location,
    website: row.website,
    instagram: row.instagram,
    summary: row.summary,
    logoUrl: publicUrl(row.logoPath),
    verified: true,
    deck:
      deckUrl && row.pdfPages && row.pdfUpdatedAt
        ? {
            url: deckUrl,
            downloadUrl: `${deckUrl}?download=${encodeURIComponent(`Team ${row.number} sponsorship deck.pdf`)}`,
            pages: row.pdfPages,
            thumbUrl: publicUrl(row.pdfThumbPath),
            updatedAt: row.pdfUpdatedAt,
          }
        : null,
  }
}
