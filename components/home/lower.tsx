import Link from 'next/link'

import { FIRST_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/shared/brand'

import { COMPANY_HREF, TEAM_HREF } from './content'
import { Arrow, I, Mark } from './icons'

export function FooterCta() {
  return (
    <section className="hp-section" aria-labelledby="hp-cta-title">
      <div className="hp-container hp-cta">
        <div className="hp-cta__main">
          <h2 id="hp-cta-title" className="hp-h-lg">
            Ready to pitch?
          </h2>
          <p className="hp-text-lg">Create an account in a minute, or set up your company to start receiving reviewed pitches.</p>
          <div className="hp-btns">
            <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--primary">
              I coach a team
              <Arrow />
            </Link>
            <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--secondary">
              I represent a company
            </Link>
          </div>
        </div>
        <div className="hp-cta__card">
          <span className="hp-charm">
            <I.gauge />
          </span>
          <p className="hp-text-md">
            <b>See what it costs.</b> Nothing. Free for teams and companies, with no payments handled here.
          </p>
          <a href="#faq" className="hp-link">
            Read the FAQ
            <Arrow />
          </a>
        </div>
        <div className="hp-cta__card">
          <span className="hp-charm">
            <I.bolt />
          </span>
          <p className="hp-text-md">
            <b>Start in minutes.</b> Sign in with Google or an email code. No password to create.
          </p>
          <Link href="/login" prefetch={false} className="hp-link">
            Sign in
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  )
}

const FOOTER: Array<[string, Array<[string, string]>]> = [
  [
    'Product',
    [
      ['How it works', '#stages'],
      ['Pitches', '#bento-pitch'],
      ['Company questions', '#bento-questions'],
      ['Review', '#bento-review'],
      ['Matching', '#bento-match'],
      ['Team pages', '#bento-public'],
    ],
  ],
  [
    'For teams',
    [
      ['Get started', TEAM_HREF],
      ['Verify your team', '#bento-verified'],
      ['Deck guide', '#guide'],
      ['Find your path', '#find'],
    ],
  ],
  [
    'For companies',
    [
      ['Set up your company', COMPANY_HREF],
      ['Write your questions', '#bento-questions'],
      ['Invite colleagues', '#companies'],
    ],
  ],
  [
    'FTC Pitfund',
    [
      ['FAQ', '#faq'],
      ['Email support', `mailto:${SUPPORT_EMAIL}`],
      ['Terms', '/legal/terms'],
      ['Privacy', '/legal/privacy'],
    ],
  ],
]

export function Footer() {
  return (
    <footer className="hp-footer">
      <div className="hp-footer__inner">
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
              {h === 'FTC Pitfund' ? (
                <Link href="/login" prefetch={false} className="hp-link hp-footer__signin">
                  Sign in
                  <Arrow />
                </Link>
              ) : null}
            </nav>
          ))}
        </div>
        <div className="hp-footer__bottom">
          <div>
            <p>Built by Anish Yarrakonda · Idea by Rishi Jhaveri (outreach lead) and Shreyas Vempati (team captain) · FTC Team 31579 Exodius</p>
            <p>
              © 2026 FTC Pitfund · {FIRST_DISCLAIMER}
            </p>
          </div>
          <Mark className="hp-footer__mark" />
        </div>
      </div>
    </footer>
  )
}
