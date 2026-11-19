import 'server-only'
import { cacheLife } from 'next/cache'
import { ImageResponse } from 'next/og'
import type { ReactNode } from 'react'

import { ACCENT, INK } from '@/lib/shared/brand'
import { placeLabel } from '@/lib/shared/team'

import type { PublicTeam } from './data/public-team'

/*
 * Share cards (Open Graph / Twitter) and the app mark as images, rendered with next/og. The mark
 * is the same path as components/app/wordmark.tsx and app/icon.svg. Type is Inter (400 and 600),
 * fetched from Google Fonts once per server instance; if that fails the cards fall back to next/og's
 * built-in font rather than erroring.
 */

export const OG_SIZE = { width: 1200, height: 630 }

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }
let interFonts: Promise<Font[]> | null = null

function fonts(): Promise<Font[]> {
  interFonts ??= loadInter().catch((error) => {
    console.warn('[og] Inter unavailable, using the built-in font', error instanceof Error ? error.message : error)
    interFonts = null
    return []
  })
  return interFonts
}

async function loadInter(): Promise<Font[]> {
  const signal = AbortSignal.timeout(4000)
  const css = await (await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;600', { signal })).text()
  const faces = [...css.matchAll(/font-weight: (400|600);\s*src: url\(([^)]+)\) format\('truetype'\)/g)]
  if (faces.length < 2) throw new Error('unexpected font CSS')
  return Promise.all(
    faces.map(async ([, weight, url]) => {
      const response = await fetch(url, { signal })
      if (!response.ok) throw new Error(`font ${response.status}`)
      return { name: 'Inter', data: await response.arrayBuffer(), weight: Number(weight) as 400 | 600, style: 'normal' as const }
    }),
  )
}

const TEXT_SECONDARY = '#6f7988'
const TEXT_TERTIARY = '#646d7b'
const BORDER = '#e4e7ec'

/** The exact P mark as an SVG data URI: blue on its own, or white on a blue tile (the app icon). */
export function markSrc({ tile = false }: { tile?: boolean } = {}) {
  const fg = tile ? '#ffffff' : ACCENT
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    (tile ? `<rect width="32" height="32" fill="${ACCENT}"/>` : '') +
    `<g transform="translate(0, 1)">` +
    `<rect x="9.5" y="7.5" width="4" height="17" rx="1.6" fill="${fg}" />` +
    `<path d="M11.5 7.5H18a5.3 5.3 0 0 1 0 10.6h-6.5" stroke="${fg}" stroke-width="4" stroke-linecap="round" fill="none" />` +
    `</g>` +
    `</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/** The wordmark as the site's header sets it: the blue mark and "pitfund" in near-black. */
function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/og renders <img>, not the DOM */}
      <img src={markSrc()} width={60} height={60} />
      <div style={{ fontSize: 40, fontWeight: 600, color: INK, letterSpacing: -1.8 }}>pitfund</div>
    </div>
  )
}

/**
 * The homepage's look at card size: a white page, the lavender field with its fine vertical lines
 * rising from the bottom, and a hairline frame.
 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#ffffff', position: 'relative', fontFamily: 'Inter' }}>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'radial-gradient(ellipse 1300px 560px at 50% 125%, #b4c3ff 0%, #d9e1ff 40%, rgba(255,255,255,0) 85%)',
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'linear-gradient(90deg, rgba(36,99,226,0.06) 1px, rgba(255,255,255,0) 1px)',
          backgroundSize: '14px 14px',
          opacity: 0.7,
        }}
      />
      <div style={{ display: 'flex', position: 'absolute', top: 28, left: 28, right: 28, bottom: 28, border: `1px solid ${BORDER}`, borderRadius: 20 }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '76px 92px' }}>
        {children}
      </div>
    </div>
  )
}

/** The generic card: brand and the two-tone headline. Used for public pages and as the fallback for any failure. */
export async function renderGenericCard(init?: ResponseInit) {
  return new ImageResponse(
    (
      <Frame>
        <Brand />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, lineHeight: 1, fontWeight: 600, letterSpacing: -3.2 }}>
            <span style={{ color: INK }}>Sponsorship pitches</span>
            <span style={{ color: INK }}>companies actually read.</span>
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.3, color: TEXT_SECONDARY, maxWidth: 900, letterSpacing: -0.4 }}>
            FIRST® Tech Challenge teams pitch companies that sponsor robotics. A real person checks every pitch.
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, ...init, fonts: await fonts() },
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
              <div style={{ display: 'block', fontSize: 72, lineHeight: 1.05, fontWeight: 600, color: INK, letterSpacing: -2.6, lineClamp: 2, overflow: 'hidden' }}>
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
    { ...OG_SIZE, ...init, fonts: await fonts() },
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
          style={{ borderRadius: 10, border: `1px solid ${BORDER}`, boxShadow: '0 2px 4px rgba(11, 13, 24, 0.04), 0 16px 40px rgba(11, 13, 24, 0.12)' }}
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
        style={logo ? { borderRadius: 24, border: `1px solid ${BORDER}`, background: '#ffffff', boxShadow: '0 16px 40px rgba(11, 13, 24, 0.10)' } : {}}
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
