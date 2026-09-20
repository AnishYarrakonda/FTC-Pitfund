import Link from 'next/link'

import { LandingSessionActions } from '@/components/app/landing-session-actions'

import { COMPANY_HREF, TEAM_HREF } from './content'
import { Arrow, Chevron, I, Mark } from './icons'

/*
 * The reference's navigation: a transparent bar over the hero; hovering a trigger drops a panel attached to the
 * bar (clip-path reveal, bottom radius, long soft shadow) while the page behind it blurs, and moving
 * between triggers slides the panel contents sideways. Below 1024px the triggers collapse into a
 * full-screen menu with expandable rows and a pinned pair of buttons. All behavior lives in
 * effects/nav.ts; this is the markup, rendered on the server.
 */

type Item = { href: string; title: string; body: string; icon: keyof typeof I; tone: string }

const MENUS: Array<{ key: string; label: string; columns: Array<{ heading: string; items: Item[] }>; aside?: { title: string; body: string; href: string; cta: string } }> = [
  {
    key: 'product',
    label: 'Product',
    columns: [
      {
        heading: 'How it works',
        items: [
          { href: '#bento-pitch', title: 'Pitches', body: 'Pitch any approved company', icon: 'send', tone: '#10b981' },
          { href: '#bento-questions', title: 'Questions', body: 'Each company asks its own', icon: 'question', tone: '#84cc16' },
          { href: '#bento-review', title: 'Review', body: 'A person reads every pitch', icon: 'eye', tone: '#1e40af' },
          { href: '#bento-match', title: 'Matching', body: 'Contacts only on Interested', icon: 'check', tone: '#eab308' },
        ],
      },
      {
        heading: 'Trust',
        items: [
          { href: '#bento-verified', title: 'Verification', body: 'Checked against FIRST records', icon: 'shield', tone: '#3b82f6' },
          { href: '#bento-public', title: 'Team pages', body: 'One public link per team', icon: 'file', tone: '#00d4ff' },
        ],
      },
    ],
    aside: { title: 'See a pitch move', body: 'Follow one pitch from draft to match, stage by stage.', href: '#stages', cta: 'Walk through it' },
  },
  {
    key: 'teams',
    label: 'Teams',
    columns: [
      {
        heading: 'For coaches',
        items: [
          { href: TEAM_HREF, title: 'Get started', body: 'Sign in with an email code', icon: 'bolt', tone: '#1e40af' },
          { href: '#bento-verified', title: 'Verify your team', body: 'Team number and a FIRST screenshot', icon: 'shield', tone: '#3b82f6' },
          { href: '#bento-public', title: 'Upload your deck', body: 'Five pages, one PDF, one summary', icon: 'file', tone: '#00d4ff' },
          { href: '#bento-pitch', title: 'Pitch a company', body: 'Answer that company’s questions', icon: 'send', tone: '#10b981' },
        ],
      },
    ],
  },
  {
    key: 'companies',
    label: 'Companies',
    columns: [
      {
        heading: 'For sponsors',
        items: [
          { href: COMPANY_HREF, title: 'Set up your company', body: 'Reviewed before teams can pitch you', icon: 'bolt', tone: '#1e40af' },
          { href: '#bento-questions', title: 'Write your questions', body: 'Up to ten, or three defaults', icon: 'question', tone: '#84cc16' },
          { href: '#bento-match', title: 'Answer pitches', body: 'Interested or Not a fit', icon: 'check', tone: '#eab308' },
          { href: '#companies', title: 'Invite colleagues', body: 'One owner, any number of editors', icon: 'users', tone: '#00b261' },
        ],
      },
    ],
    aside: { title: 'Free, always', body: 'No fees, and no money moves through FTC Pitfund.', href: '#faq', cta: 'Read the FAQ' },
  },
  {
    key: 'resources',
    label: 'Resources',
    columns: [
      {
        heading: 'Help',
        items: [
          { href: '#faq', title: 'FAQ', body: 'Sharing, review, cost and more', icon: 'question', tone: '#1e40af' },
          { href: 'mailto:ftcexodius@gmail.com', title: 'Email support', body: 'ftcexodius@gmail.com', icon: 'mail', tone: '#00b261' },
        ],
      },
      {
        heading: 'Policies',
        items: [
          { href: '/legal/terms', title: 'Terms', body: 'The rules for using FTC Pitfund', icon: 'flag', tone: '#3b82f6' },
          { href: '/legal/privacy', title: 'Privacy', body: 'What we keep, and why', icon: 'lock', tone: '#64748d' },
        ],
      },
    ],
  },
]

function MenuItem({ item }: { item: Item }) {
  const Icon = I[item.icon]
  return (
    <li>
      <Link href={item.href} prefetch={false} className="hp-menu-item" data-hp-close>
        <span className="hp-menu-item__icon" style={{ color: item.tone }}>
          <Icon />
        </span>
        <span>
          <span className="hp-menu-item__title">{item.title}</span>
          <span className="hp-menu-item__body">{item.body}</span>
        </span>
      </Link>
    </li>
  )
}

export function HomeNav() {
  return (
    <header className="hp-nav" data-hp-nav>
      <div className="hp-nav__bar">
        <div className="hp-nav__inner">
          <Link href="/" className="hp-nav__logo" aria-label="FTC Pitfund home">
            <Mark />
          </Link>

          <nav aria-label="Main" className="hp-nav__main">
            <ul className="hp-nav__triggers">
              {MENUS.map((m) => (
                <li key={m.key}>
                  <button type="button" className="hp-nav__trigger" data-hp-trigger={m.key} aria-expanded="false" aria-controls={`hp-panel-${m.key}`}>
                    {m.label}
                    <Chevron className="hp-nav__chev" />
                  </button>
                </li>
              ))}
              <li>
                <a href="#faq" className="hp-nav__trigger hp-nav__trigger--link">
                  FAQ
                </a>
              </li>
              <li className="hp-nav__sep" aria-hidden="true" />
              <li>
                <a href="#find" className="hp-nav__trigger hp-nav__trigger--link">
                  <I.sparkle className="hp-nav__spark" />
                  Find your path
                </a>
              </li>
            </ul>
            <div className="hp-nav__actions">
              <LandingSessionActions primaryClass="hp-btn hp-btn--sm hp-btn--primary" ghostClass="hp-btn hp-btn--sm hp-btn--secondary hp-nav__signin" arrow={<Arrow />} />
            </div>
          </nav>

          <button type="button" className="hp-nav__burger" data-hp-burger aria-expanded="false" aria-controls="hp-mnav" aria-label="Open menu">
            <I.menu />
          </button>
        </div>

        <div className="hp-nav__popup" data-hp-popup data-status="closed">
          <div className="hp-nav__viewport">
            {MENUS.map((m) => (
              <div key={m.key} id={`hp-panel-${m.key}`} className="hp-nav__panel" data-hp-panel={m.key} role="region" aria-label={m.label}>
                <div className="hp-nav__panel-cols">
                  {m.columns.map((c) => (
                    <div key={c.heading} className="hp-nav__col">
                      <p className="hp-nav__heading">{c.heading}</p>
                      <ul className="hp-nav__list">
                        {c.items.map((it) => (
                          <MenuItem key={it.title} item={it} />
                        ))}
                      </ul>
                    </div>
                  ))}
                  {m.aside ? (
                    <Link href={m.aside.href} prefetch={false} className="hp-nav__aside" data-hp-close>
                      <span className="hp-nav__aside-art" aria-hidden="true" />
                      <span className="hp-nav__aside-title">{m.aside.title}</span>
                      <span className="hp-nav__aside-body">{m.aside.body}</span>
                      <span className="hp-link hp-link--sm">
                        {m.aside.cta}
                        <Arrow />
                      </span>
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hp-nav__scrim" data-hp-scrim aria-hidden="true" />

      {/* Mobile: a full-screen sheet with expandable rows and a pinned pair of buttons. */}
      <div id="hp-mnav" className="hp-mnav" data-hp-mnav hidden>
        <div className="hp-mnav__top">
          <Link href="/" className="hp-nav__logo" aria-label="FTC Pitfund home">
            <Mark />
          </Link>
          <button type="button" className="hp-mnav__close" data-hp-burger-close aria-label="Close menu">
            <I.close />
          </button>
        </div>
        <div className="hp-mnav__body">
          {/* The menu groups are copied in from the desktop panels on first open (effects/nav.ts). */}
          <ul className="hp-mnav__list" data-hp-mnav-list>
            <li>
              <a href="#faq" className="hp-mnav__row" data-hp-close>
                FAQ
              </a>
            </li>
            <li>
              <Link href="/login" prefetch={false} className="hp-mnav__row">
                Sign in
              </Link>
            </li>
          </ul>
          <div className="hp-mnav__card">
            <p className="hp-strong hp-text-sm">Not sure where to start?</p>
            <a href="#find" className="hp-link hp-link--sm" data-hp-close>
              Find your path
            </a>
            <p className="hp-text-sm hp-sub">Tell us who you are and what you need</p>
            <a href="#stages" className="hp-link hp-link--sm" data-hp-close>
              See how a pitch moves
            </a>
            <p className="hp-text-sm hp-sub">Four stages, from draft to match</p>
          </div>
        </div>
        <div className="hp-mnav__foot">
          <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--sm hp-btn--primary">
            I coach a team
            <Arrow />
          </Link>
          <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--sm hp-btn--secondary">
            I represent a company
          </Link>
        </div>
      </div>
    </header>
  )
}
