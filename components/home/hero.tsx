import Link from 'next/link'
import type { ReactNode } from 'react'

import { COMPANY_HREF, TEAM_HREF } from './content'
import { Arrow } from './icons'

/*
 * The reference's hero: a silk ribbon (WebGL, effects/wave.ts; a CSS painting until it loads) sweeps behind the
 * right side of the page and the top bar; the headline is drawn twice, a plain layer and a hard-light
 * layer above it, so where the ribbon passes behind the words they pick up its color. Above it a live
 * figure rolls its digits (here: time left in the pitch season), and below it a logo marquee.
 */

const LINE_1 = 'Sponsorship pitches companies actually read.'
const LINE_2 = 'Upload your team’s deck once, answer each sponsor’s own questions, and have every pitch checked by a real person before it lands.'

function Title({ as: As, className, ...rest }: { as: 'h1' | 'div'; className: string; 'aria-hidden'?: boolean }) {
  return (
    <As className={className} {...rest}>
      <em className="hp-hero__title-main">{LINE_1}</em> <span>{LINE_2}</span>
    </As>
  )
}

/* Kinds of organizations that sponsor FTC teams. A category strip, not a customer list. */
const SPONSOR_KINDS: Array<{ name: string; glyph: ReactNode; style?: string }> = [
  { name: 'Aerospace', glyph: <path d="M3 13.5 21 6l-4.5 12-3.5-4.5L3 13.5Z" /> },
  { name: 'Semiconductors', glyph: <path d="M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />, style: 'mono' },
  { name: 'Robotics', glyph: <path d="M8 9h8v8H8zM12 5v4M6 13H4M20 13h-2M10 12.5h.01M14 12.5h.01" /> },
  { name: 'Engineering', glyph: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />, style: 'wide' },
  { name: 'Manufacturing', glyph: <path d="M3 20V10l6 3.5V10l6 3.5V6h6v14H3Z" />, style: 'heavy' },
  { name: 'Energy', glyph: <path d="M13 2 5 13.5h6L10 22l8-11h-6l1-9Z" /> },
  { name: 'Software', glyph: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />, style: 'mono' },
  { name: 'Automotive', glyph: <path d="M4 15.5 6 10h12l2 5.5M4 15.5h16v3H4zM7.5 18.5v1.5M16.5 18.5v1.5" />, style: 'heavy' },
  { name: 'Medical devices', glyph: <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z" /> },
  { name: 'Credit unions', glyph: <path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />, style: 'wide' },
  { name: 'Telecom', glyph: <path d="M12 12v9M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15" /> },
  { name: 'Utilities', glyph: <path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11Z" />, style: 'heavy' },
]

export function Hero() {
  return (
    <section className="hp-hero" aria-labelledby="hp-hero-title">
      <div className="hp-hero__bg" aria-hidden="true">
        <span className="hp-bleed-line hp-hero__line-top" />
        <span className="hp-bleed-line hp-hero__line-bottom" />

      </div>

      <div className="hp-hero__layout">
        <div className="hp-hero__grid">
          <div className="hp-hero__text">
            <p className="hp-hero__eyebrow hp-rise hp-rise-1" >
              <span className="hp-hero__eyebrow-label">Time left in the 2026–27 pitch season:</span>{' '}
              <span className="hp-hero__eyebrow-value hp-tabular" data-hp-countdown aria-live="off">
                &nbsp;
              </span>
            </p>
            <div className="hp-hero__titles hp-rise hp-rise-2">
              <Title as="h1" className="hp-hero__title hp-hero__title--left" />
              <span id="hp-hero-title" hidden>
                {LINE_1} {LINE_2}
              </span>
            </div>

            <div className="hp-btns hp-hero__actions hp-hero__actions--left hp-rise hp-rise-4">
              <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--primary">
                Start your team&apos;s pitch
                <Arrow />
              </Link>
              <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--white">
                I represent a company
              </Link>
            </div>

            <ul className="hp-hero-proof hp-rise hp-rise-5">
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Free for teams</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Every pitch human-reviewed</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Contacts private until a match</li>
            </ul>
          </div>

          <div className="hp-hero__visual hp-rise hp-rise-6" aria-label="Preview of a team's pitch in FTC Pitfund" role="img">
            {/* Reviewer note */}
            <div className="hp-ui-card hp-float hp-float-review">
              <div className="hp-rev-head">
                <div className="hp-rev-avatar">PF</div>
                <div>
                  <div className="hp-rev-title">Approved by reviewer</div>
                  <div className="hp-rev-sub">Pitfund admin · 2h ago</div>
                </div>
              </div>
              <p className="hp-rev-note">Clear budget and a strong outreach answer. Sent to Ribosome Robotics.</p>
            </div>

            {/* Main pitch window */}
            <div className="hp-ui-card hp-app-window">
              <div className="hp-app-bar">
                <div className="hp-app-dots"><i /><i /><i /></div>
                <div className="hp-app-crumb">Pitches / <b>Ribosome Robotics</b></div>
              </div>
              <div className="hp-app-body">
                <div className="hp-team-row">
                  <div className="hp-team-mark">EX</div>
                  <div>
                    <div className="hp-team-name">Exodius</div>
                    <div className="hp-team-meta">Team 31579 · 2026–27 season</div>
                  </div>
                  <span className="hp-badge hp-badge-verified">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    FIRST verified
                  </span>
                </div>

                <div>
                  <div className="hp-label">Sponsorship deck · 5 pages</div>
                  <div className="hp-deck">
                    <div className="hp-deck-page hp-cover"></div>
                    <div className="hp-deck-page"></div>
                    <div className="hp-deck-page"></div>
                    <div className="hp-deck-page"></div>
                    <div className="hp-deck-page"></div>
                  </div>
                </div>

                <div className="hp-qa">
                  <div className="hp-qa-q">How would your team use our support this season?</div>
                  <p className="hp-qa-a">Machined drivetrain parts for our worlds robot, plus two summer workshops for local FLL teams.</p>
                </div>

                <div className="hp-steps">
                  <div className="hp-step"><span className="hp-step-dot"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>Submitted</div>
                  <div className="hp-step"><span className="hp-step-dot"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>Reviewed</div>
                  <div className="hp-step hp-is-live"><span className="hp-step-dot"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>Interested</div>
                </div>
              </div>
            </div>

            {/* Match notification */}
            <div className="hp-ui-card hp-float hp-float-match">
              <div className="hp-pop-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div className="hp-pop-title">Ribosome Robotics is interested</div>
                <div className="hp-pop-sub">Contact details are now shared with both of you.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hp-logos">
        <h2 className="hp-sr">Kinds of companies that sponsor FTC teams</h2>
        <div className="hp-logos__viewport" data-hp-marquee>
          <ul className="hp-logos__track">
            {[0, 1].map((copy) =>
              SPONSOR_KINDS.map((k) => (
                <li key={`${copy}-${k.name}`} className={`hp-logos__item hp-logos__item--${k.style ?? 'plain'}`} aria-hidden={copy === 1 ? true : undefined}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {k.glyph}
                  </svg>
                  <span>{k.name}</span>
                </li>
              )),
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
