import { ImageResponse } from 'next/og'

import { markSrc } from '@/lib/server/og'

/* The home-screen icon: the hexagon-and-spark mark, full bleed (iOS rounds the corners itself). Static. */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- next/og renders <img>, not the DOM */}
        <img src={markSrc({ rounded: false })} width={180} height={180} />
      </div>
    ),
    size,
  )
}
