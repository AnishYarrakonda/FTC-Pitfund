import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'
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
  city: string | null
  state: string | null
  website: string | null
  summary: string | null
  logoUrl: string | null
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

/** The uncached query behind getPublicTeam (tests call it directly). */
export async function queryPublicTeam(number: number): Promise<PublicTeam | null> {
  const [row] = await getDb()
    .select({
      id: teams.id,
      number: teams.number,
      name: teams.name,
      city: teams.city,
      state: teams.state,
      website: teams.website,
      summary: teams.summary,
      logoPath: teams.logoPath,
      pdfPath: teams.pdfPath,
      pdfPages: teams.pdfPages,
      pdfThumbPath: teams.pdfThumbPath,
      pdfUpdatedAt: teams.pdfUpdatedAt,
      verifiedAt: teams.verifiedAt,
    })
    .from(teams)
    .where(and(eq(teams.number, number), isNull(teams.suspendedAt)))
    .limit(1)

  if (!row) return null

  const deckUrl = publicUrl(row.pdfPath)
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    city: row.city,
    state: row.state,
    website: row.website,
    summary: row.summary,
    logoUrl: publicUrl(row.logoPath),
    verified: Boolean(row.verifiedAt),
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
