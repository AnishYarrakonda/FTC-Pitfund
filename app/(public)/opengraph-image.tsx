import { OG_SIZE, renderGenericCard } from '@/lib/server/og'

/* The share card for public pages. Static: rendered once at build time. */

export const alt = 'FTC Pitfund: sponsorship pitches companies actually read.'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return renderGenericCard()
}
