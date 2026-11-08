import Link from 'next/link'

import { FIRST_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/shared/brand'

import { COMPANY_HREF, TEAM_HREF } from './content'
import { Arrow, Mark } from './icons'

export function FooterCta() {
  return (
    <section className="hp-section" aria-labelledby="hp-cta-title">
      <div className="hp-container">
        <div className="hp-cta">
          <div className="hp-cta__dots" aria-hidden="true" />
          <h2 id="hp-cta-title" className="hp-h1">
            Ready to <span className="hp-hl">pitch?</span>
          </h2>
          <p>Sign in with an email code, no password to create. Free for teams and companies, with no payments handled here.</p>
          <div className="hp-btns hp-btns--center">
            <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--primary hp-btn--lg">
              I coach a team
              <Arrow />
            </Link>
            <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--outline hp-btn--lg">
              I represent a company
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

const FOOTER: Array<[string, Array<[string, string]>]> = [
  [
    'Product',
    [
      ['How it works', '#how'],
      ['Features', '#features'],
      ['Review', '#feature-review'],
      ['Matching', '#feature-match'],
      ['Team pages', '#feature-public'],
    ],
  ],
  [
    'For teams',
    [
      ['Get started', TEAM_HREF],
      ['Verify your team', '#feature-verified'],
      ['Find where to start', '#find'],
    ],
  ],
  [
    'For companies',
    [
      ['Set up your company', COMPANY_HREF],
      ['Write your questions', '#feature-questions'],
      ['What companies get', '#companies'],
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
    <footer className="hp-footer">
      <div className="hp-container">
        <div className="hp-footer__top">
          <div className="hp-footer__brand">
            <Mark />
            <p>Sponsorship pitches companies actually read.</p>
          </div>
          <div className="hp-footer__cols">
            {FOOTER.map(([h, links]) => (
              <nav key={h} aria-label={h} className="hp-footer__col">
                <p className="hp-footer__heading">{h}</p>
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
          <p>
            © 2026 FTC Pitfund · {FIRST_DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  )
}
