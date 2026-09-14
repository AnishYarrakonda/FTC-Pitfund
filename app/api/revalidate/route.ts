import { revalidateTag } from 'next/cache'

import { TAGS } from '@/lib/server/cache-tags'
import { env } from '@/lib/server/env'

/*
 * POST /api/revalidate with `Authorization: Bearer $CRON_SECRET`: expire the cached public team
 * pages and the sponsor directory right now. `npm run seed` calls it on the local servers so a
 * reseed never shows stale cached pages; ops can call it after fixing data outside the app.
 */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Not found', { status: 404 })
  }
  for (const tag of [TAGS.teams, TAGS.sponsors]) revalidateTag(tag, { expire: 0 })
  return Response.json({ revalidated: [TAGS.teams, TAGS.sponsors] })
}
