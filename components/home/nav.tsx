import Link from 'next/link'

import { LandingSessionActions } from '@/components/app/landing-session-actions'

import { COMPANY_HREF, MENU, TEAM_HREF } from './content'
import { Arrow, Chevron, I, Mark } from './icons'

/*
 * The sticky head of the page: a black one-line season banner (dismissible) over a white bar with the
 * mark, a Product menu, three in-page links and the session actions. The bar turns dark while it sits
 * over a dark section (effects/scroll.ts sets data-tone). Below 1024px the links fold into a sheet the
 * burger opens (effects/nav.ts); everything here is server-rendered.
 */

const LINKS: Array<[string, string]> = [
  ['How it works', '#how'],
  ['For companies', '#sides'],
  ['FAQ', '#faq'],
]

const MOBILE_LINKS: Array<[string, string]> = [
  ['How it works', '#how'],
  ['Reviewed first', '#review'],
  ['What’s shared, and when', '#shared'],
  ['For companies', '#sides'],
  ['FAQ', '#faq'],
  ['Find where to start', '#find'],
]

export function SiteHead() {
  return (
    <div className="hp-head" data-hp-head>
      <div className="hp-banner" data-hp-banner>
        <Link href={TEAM_HREF} prefetch={false} className="hp-banner__link">
          <span>
            <span className="hp-banner__hide-sm">The 2026–27 pitch season closes in </span>
            <span className="hp-banner__show-sm">Season closes in </span>
            <span className="hp-banner__count hp-tabular" data-hp-countdown aria-live="off">
              &nbsp;
            </span>
          </span>
          <Arrow />
        </Link>
        <button type="button" className="hp-banner__close" data-hp-banner-close aria-label="Dismiss the season banner">
          <I.close />
        </button>
      </div>

      <header className="hp-nav" data-hp-nav data-tone="light">
        <div className="hp-nav__inner">
          <Link href="/" className="hp-nav__logo" aria-label="FTC Pitfund home">
            <Mark />
          </Link>

          <nav aria-label="Main" className="hp-nav__main">
            <ul className="hp-nav__links">
              <li className="hp-nav__item">
                <button type="button" className="hp-nav__link" aria-expanded="false" aria-controls="hp-menu-product" data-hp-menu-trigger>
                  Product
                  <Chevron />
                </button>
                <div id="hp-menu-product" className="hp-menu" data-hp-menu hidden>
                  <div className="hp-menu__cols">
                    {MENU.columns.map((col) => (
                      <div key={col.heading} className="hp-menu__col">
                        <p className="hp-menu__heading">{col.heading}</p>
                        <ul>
                          {col.items.map((it) => (
                            <li key={it.title}>
                              <a href={it.href} className="hp-menu__item" data-hp-menu-close>
                                <span className="hp-menu__title">{it.title}</span>
                                <span className="hp-menu__body">{it.body}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="hp-menu__aside">
                    {MENU.aside.map((group) => (
                      <div key={group.heading} className="hp-menu__group">
                        <p className="hp-menu__heading">{group.heading}</p>
                        <ul>
                          {group.links.map(([label, href]) => (
                            <li key={label}>
                              <Link href={href} prefetch={false} className="hp-menu__link" data-hp-menu-close>
                                {label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
              {LINKS.map(([label, href]) => (
                <li key={href} className="hp-nav__item">
                  <a href={href} className="hp-nav__link">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="hp-nav__actions">
              <LandingSessionActions primaryClass="hp-btn hp-btn--primary" ghostClass="hp-btn hp-btn--outline" />
            </div>
          </nav>

          <button type="button" className="hp-nav__burger" data-hp-burger aria-expanded="false" aria-controls="hp-mnav" aria-label="Open menu">
            <span className="hp-nav__burger-lines" aria-hidden="true">
              <i />
              <i />
            </span>
          </button>
        </div>

        <div id="hp-mnav" className="hp-mnav" data-hp-mnav hidden>
          <ul className="hp-mnav__list">
            {MOBILE_LINKS.map(([label, href]) => (
              <li key={label}>
                <a href={href} className="hp-mnav__row" data-hp-close>
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="hp-mnav__foot">
            <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--outline hp-btn--block">
              I represent a company
            </Link>
            <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--primary hp-btn--block">
              I coach a team
            </Link>
          </div>
        </div>
      </header>
    </div>
  )
}
