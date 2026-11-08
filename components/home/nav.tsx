import Link from 'next/link'

import { LandingSessionActions } from '@/components/app/landing-session-actions'

import { COMPANY_HREF, TEAM_HREF } from './content'
import { Arrow, I, Mark } from './icons'

/*
 * The top of the page: a one-line season banner, then a sticky dark bar with the mark, four in-page
 * links and the session actions. Below 1024px the links fold into a menu the burger opens
 * (effects/nav.ts toggles it; everything else here is server-rendered).
 */

const LINKS: Array<[string, string]> = [
  ['How it works', '#how'],
  ['Features', '#features'],
  ['For companies', '#companies'],
  ['FAQ', '#faq'],
]

export function SeasonBanner() {
  return (
    <div className="hp-banner">
      <p className="hp-banner__inner">
        <span className="hp-banner__label">
          <span className="hp-banner__hide-sm">Time left in the </span>2026–27 pitch season
        </span>
        <span className="hp-banner__count hp-tabular" data-hp-countdown aria-live="off">
          &nbsp;
        </span>
        <span className="hp-banner__sep" aria-hidden="true" />
        <Link href={TEAM_HREF} prefetch={false} className="hp-banner__link">
          Start your pitch
          <Arrow />
        </Link>
      </p>
    </div>
  )
}

export function HomeNav() {
  return (
    <header className="hp-nav" data-hp-nav>
      <div className="hp-nav__inner">
        <Link href="/" className="hp-nav__logo" aria-label="FTC Pitfund home">
          <Mark />
        </Link>

        <nav aria-label="Main" className="hp-nav__main">
          <ul className="hp-nav__links">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <a href={href} className="hp-nav__link">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="hp-nav__actions">
            <LandingSessionActions primaryClass="hp-btn hp-btn--sm hp-btn--primary" ghostClass="hp-btn hp-btn--sm hp-btn--ghost" arrow={<Arrow />} />
          </div>
        </nav>

        <button type="button" className="hp-nav__burger" data-hp-burger aria-expanded="false" aria-controls="hp-mnav" aria-label="Open menu">
          <I.menu className="hp-nav__burger-open" />
          <I.close className="hp-nav__burger-close" />
        </button>
      </div>

      <div id="hp-mnav" className="hp-mnav" data-hp-mnav hidden>
        <ul className="hp-mnav__list">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <a href={href} className="hp-mnav__row" data-hp-close>
                {label}
                <Arrow />
              </a>
            </li>
          ))}
          <li>
            <a href="#find" className="hp-mnav__row" data-hp-close>
              Find where to start
              <Arrow />
            </a>
          </li>
        </ul>
        <div className="hp-mnav__foot">
          <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--primary">
            I coach a team
          </Link>
          <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--outline">
            I represent a company
          </Link>
        </div>
      </div>
    </header>
  )
}
