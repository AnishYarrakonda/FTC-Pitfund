import { getPublicTeam } from '@/lib/server/data/public-team'
import { OG_SIZE, renderGenericCard, renderTeamCard } from '@/lib/server/og'

/*
 * The share card for a public team page. The team lookup is cached per team and the images per
 * URL (lib/server/og.tsx). A missing or suspended team, or any rendering failure, gets the generic
 * card: a share preview never errors.
 */

export const alt = 'A team’s sponsorship page on FTC Pitfund'
export const size = OG_SIZE
export const contentType = 'image/png'

// Team details change, so browsers and CDNs refresh the card within the hour.
const CACHE = { headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } }

export default async function Image({ params }: { params: Promise<{ number: string }> }) {
  try {
    const { number } = await params
    const team = /^\d{1,6}$/.test(number) ? await getPublicTeam(Number(number)) : null
    if (!team) return renderGenericCard(CACHE)
    const card = await renderTeamCard(team, CACHE)
    // ImageResponse renders lazily; read it here so a rendering error still falls back.
    return new Response(await card.arrayBuffer(), { headers: card.headers })
  } catch (error) {
    console.error('[og] team card failed', error)
    return renderGenericCard(CACHE)
  }
}
