import type { MetadataRoute } from 'next'
import { connection } from 'next/server'

import { listPublicTeamPages } from '@/lib/server/data/public-team'
import { absoluteUrl } from '@/lib/server/env'

/*
 * /sitemap.xml: the landing page, the legal pages and every public team page. `connection()`
 * keeps it out of the build (no database at build time); the team list itself is cached for
 * hours (lib/server/data/public-team.ts), so a crawler costs a cache read.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const teams = await listPublicTeamPages()

  return [
    { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    { url: absoluteUrl('/legal/terms'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/legal/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    ...teams.map((team) => ({
      url: absoluteUrl(`/t/${team.number}`),
      lastModified: team.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]
}
