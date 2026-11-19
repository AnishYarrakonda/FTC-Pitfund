import Link from 'next/link'

import { FIRST_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/shared/brand'

import { COMPANY_HREF, TEAM_HREF } from './content'
import { Arrow, Mark } from './icons'

/* The dark close of the page: one line and the two doors, then the footer. */

export function FooterCta() {
  return (
    <section className="hp-cta" aria-labelledby="hp-cta-title" data-hp-tone="dark">
      <div className="hp-cta__lines" aria-hidden="true" />
      <div className="hp-cta__inner" data-hp-reveal>
        <h2 id="hp-cta-title" className="hp-cta__title">
          Ready to pitch?
        </h2>
        <p className="hp-cta__sub">Sign in with an email code. Free for teams and companies.</p>
        <div className="hp-cta__btns">
          <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--dark-outline">
            I represent a company
          </Link>
          <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--raised">
            I coach a team
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  )
}

const FOOTER: Array<[string, Array<[string, string]>]> = [
  [
    'How it works',
    [
      ['Set up your team', '#team-page'],
      ['Pitch a company', '#pitch'],
      ['Reviewed first', '#review'],
      ['The company answers', '#answers'],
      ['Matched', '#matched'],
    ],
  ],
  [
    'For teams',
    [
      ['Get started', TEAM_HREF],
      ['What’s shared, and when', '#shared'],
      ['The season', '#season'],
      ['Find where to start', '#find'],
    ],
  ],
  [
    'For companies',
    [
      ['Set up your company', COMPANY_HREF],
      ['What companies get', '#sides'],
      ['Read by a person', '#review'],
    ],
  ],
  [
    'FTC Pitfund',
    [
      ['FAQ', '#faq'],
      ['Email support', `mailto:${SUPPORT_EMAIL}`],
      ['Terms', '/legal/terms'],
      ['Privacy', '/legal/privacy'],
      ['Sign in', '/login'],
    ],
  ],
]

export function Footer() {
  return (
    <footer className="hp-footer" data-hp-tone="dark">
      <div className="hp-footer__top">
        <div className="hp-footer__brand">
          <Mark />
          <p>Sponsorship pitches companies actually read.</p>
        </div>
        <div className="hp-footer__cols">
          {FOOTER.map(([h, links]) => (
            <nav key={h} aria-label={h} className="hp-footer__col">
              <h2 className="hp-footer__heading">{h}</h2>
              <ul>
                {links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} prefetch={false}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="hp-footer__bottom">
        <p>Built by Anish Yarrakonda · Idea by Rishi Jhaveri (outreach lead) and Shreyas Vempati (team captain) · FTC Team 31579 Exodius</p>
        <p>© 2026 FTC Pitfund · {FIRST_DISCLAIMER}</p>
      </div>
    </footer>
  )
}
