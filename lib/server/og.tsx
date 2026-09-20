import 'server-only'

import { cacheLife } from 'next/cache'
import { ImageResponse } from 'next/og'
import type { ReactNode } from 'react'

import { ACCENT, PRODUCT_NAME } from '@/lib/shared/brand'
import { placeLabel } from '@/lib/shared/team'

import type { PublicTeam } from './data/public-team'

/*
 * Share cards (Open Graph / Twitter) and the app mark as images, rendered with next/og. The mark
 * is the same path as components/app/wordmark.tsx and app/icon.svg. The default next/og font is
 * used, so there is no font file to load.
 */

export const OG_SIZE = { width: 1200, height: 630 }

const TEXT = '#061b31'
const TEXT_SECONDARY = '#50617a'
const TEXT_TERTIARY = '#64748d'
const BORDER = '#e5edf5'

/** The hexagon-and-spark mark as an SVG data URI. `rounded: false` is full-bleed (iOS rounds apple icons itself). */
export function markSrc({ rounded = true }: { rounded?: boolean } = {}) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<rect width="32" height="32" rx="${rounded ? 8 : 0}" fill="${ACCENT}"/>` +
    `<polygon points="16,6 25,11 25,21 16,26 7,21 7,11" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M16 10 C16 14.5 14.5 16 10 16 C14.5 16 16 17.5 16 22 C16 17.5 17.5 16 22 16 C17.5 16 16 14.5 16 10 Z" fill="#fff"/>` +
    `</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/og renders <img>, not the DOM */}
      <img src={markSrc()} width={56} height={56} />
      <div style={{ fontSize: 36, color: TEXT, letterSpacing: -0.5 }}>{PRODUCT_NAME}</div>
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#ffffff', position: 'relative' }}>
      <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: ACCENT }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '72px 88px 72px 100px' }}>
        {children}
      </div>
    </div>
  )
}

/** The generic card: brand and headline. Used for public pages and as the fallback for any failure. */
export function renderGenericCard(init?: ResponseInit) {
  return new ImageResponse(
    (
      <Frame>
        <Brand />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 84, lineHeight: 1.05, color: TEXT, letterSpacing: -3, maxWidth: 940 }}>
            Sponsorship pitches companies actually read.
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: TEXT_SECONDARY, maxWidth: 900 }}>
            FIRST® Tech Challenge teams pitch companies that sponsor robotics. A real person checks every pitch.
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, ...init },
  )
}

type OgImage = { src: string; width: number; height: number }

/** The team card: name, number, place, summary, and the deck's first page (or the logo, or the mark). */
export async function renderTeamCard(team: PublicTeam, init?: ResponseInit) {
  const [thumb, logo] = await Promise.all([
    team.deck?.thumbUrl ? loadOgImage(team.deck.thumbUrl, { width: 400, height: 486 }) : null,
    team.logoUrl ? loadOgImage(team.logoUrl, { width: 320, height: 320 }) : null,
  ])
  const place = placeLabel(team)
  const subtitle = [`Team ${team.number}`, place].filter(Boolean).join(' · ')

  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 56, height: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
            <Brand />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 30, color: TEXT_TERTIARY }}>{subtitle}</div>
              <div style={{ display: 'block', fontSize: 68, lineHeight: 1.08, color: TEXT, letterSpacing: -2, lineClamp: 2, overflow: 'hidden' }}>
                {team.name}
              </div>
              {team.summary ? (
                <div style={{ display: 'block', fontSize: 30, lineHeight: 1.35, color: TEXT_SECONDARY, lineClamp: 3, overflow: 'hidden' }}>
                  {team.summary}
                </div>
              ) : null}
            </div>
          </div>
          <Visual thumb={thumb} logo={logo} />
        </div>
      </Frame>
    ),
    { ...OG_SIZE, ...init },
  )
}

function Visual({ thumb, logo }: { thumb: OgImage | null; logo: OgImage | null }) {
  if (thumb) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 400, flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/og renders <img>, not the DOM */}
        <img
          src={thumb.src}
          width={thumb.width}
          height={thumb.height}
          style={{ borderRadius: 8, border: `1px solid ${BORDER}`, boxShadow: '0 12px 32px rgba(11, 11, 12, 0.12)' }}
        />
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 320, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/og renders <img>, not the DOM */}
      <img
        src={logo?.src ?? markSrc()}
        width={logo?.width ?? 200}
        height={logo?.height ?? 200}
        style={logo ? { borderRadius: 24, border: `1px solid ${BORDER}` } : {}}
      />
    </div>
  )
}

/**
 * Fetches a public image and returns it as a PNG data URI that fits inside `box`. Stored images
 * are usually WebP, which next/og can't draw, so they are converted with sharp (installed with
 * Next.js). Any failure returns null and the card falls back. Object URLs are immutable (a fresh
 * name per upload), so the result is cached by URL for days.
 */
async function loadOgImage(url: string, box: { width: number; height: number }): Promise<OgImage | null> {
  'use cache'
  cacheLife('days')
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    const { default: sharp } = await import('sharp')
    const { data, info } = await sharp(bytes)
      .resize({ width: box.width, height: box.height, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true })
    return { src: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height }
  } catch (error) {
    console.warn('[og] image unavailable', url, error instanceof Error ? error.message : error)
    return null
  }
}
