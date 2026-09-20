import { ImageResponse } from 'next/og'

import { markSrc } from '@/lib/server/og'

/* The home-screen icon: the P mark on a full-bleed accent tile (iOS rounds the corners itself). Static. */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- next/og renders <img>, not the DOM */}
        <img src={markSrc({ tile: true })} width={180} height={180} />
      </div>
    ),
    size,
  )
}
