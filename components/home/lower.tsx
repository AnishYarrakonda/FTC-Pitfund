import Link from 'next/link'

import { FIRST_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/shared/brand'

import { COMPANY_HREF, NEWS, TEAM_HREF } from './content'
import { Arrow, I, Mark } from './icons'

/* The reference's navy developer section: "Reliable, extensible infrastructure", as how the product is built. */
export function Reliable() {
  return (
    <section className="hp-section hp-dark" id="reliable" aria-labelledby="hp-rel-title">
      <div className="hp-container hp-container--bot0">
        <div className="hp-section-title hp-section-title--7 hp-title-pair hp-h-lg">
          <h2 id="hp-rel-title">Reliable by design.</h2>
          <p className="hp-sub">Every action leaves a record, every step is checked by a person, and nothing depends on an email arriving.</p>
        </div>
        <div className="hp-btns hp-rel__btns">
          <a href="#faq" className="hp-btn hp-btn--primary">
            Read the FAQ
            <Arrow />
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hp-btn hp-btn--ghost-navy">
            Email the team
          </a>
        </div>
      </div>

      <div className="hp-container hp-container--top0 hp-container--bot0">
        <div className="hp-divider" />
        <div className="hp-rel__sub hp-title-pair hp-h-sm">
          <h3>Connect every step.</h3>
          <p className="hp-sub">A pitch moves through the same stages every time, and each one is visible to the people it involves.</p>
        </div>
        <div className="hp-flow" aria-hidden="true">
          <svg className="hp-flow__wires" viewBox="0 0 1000 300" preserveAspectRatio="none">
            <path d="M160 60 C 320 60, 340 150, 500 150" />
            <path d="M160 240 C 320 240, 340 150, 500 150" />
            <path d="M500 150 C 660 150, 680 60, 840 60" />
            <path d="M500 150 C 660 150, 680 240, 840 240" />
            <path className="hp-flow__pulse" d="M160 60 C 320 60, 340 150, 500 150 C 660 150, 680 60, 840 60" />
            <path className="hp-flow__pulse hp-flow__pulse--b" d="M160 240 C 320 240, 340 150, 500 150 C 660 150, 680 240, 840 240" />
          </svg>
          <div className="hp-flow__node" style={{ left: '4%', top: '8%' }}>
            <span className="hp-flow__chip">Team page</span>
            <span className="hp-flow__chip hp-flow__chip--dim">Deck · 4 pages</span>
          </div>
          <div className="hp-flow__node" style={{ left: '4%', top: '68%' }}>
            <span className="hp-flow__chip">Company questions</span>
            <span className="hp-flow__chip hp-flow__chip--dim">4 of 10</span>
          </div>
          <div className="hp-flow__hub">
            <span className="hp-flow__hub-title">Review</span>
            <span className="hp-flow__hub-sub">A person reads it</span>
          </div>
          <div className="hp-flow__node hp-flow__node--right" style={{ right: '4%', top: '8%' }}>
            <span className="hp-flow__chip hp-flow__chip--ok">Interested</span>
            <span className="hp-flow__chip hp-flow__chip--dim">Contacts exchanged</span>
          </div>
          <div className="hp-flow__node hp-flow__node--right" style={{ right: '4%', top: '68%' }}>
            <span className="hp-flow__chip">Not a fit</span>
            <span className="hp-flow__chip hp-flow__chip--dim">Slot stays used</span>
          </div>
        </div>
      </div>

      <div className="hp-container hp-container--top0 hp-container--bot0">
        <div className="hp-divider" />
        <div className="hp-rel__sub hp-title-pair hp-h-sm">
          <h3>Built to never drop a message.</h3>
          <p className="hp-sub">Email is capped, queued and quota-aware, and the in-app notification is always written first.</p>
        </div>
        <div className="hp-rel__wave" aria-hidden="true">
          <canvas data-hp-lines="cool" />
        </div>
        <div className="hp-rel__stats">
          <div>
            <p className="hp-rel__num hp-rel__num--a">100/day</p>
            <p className="hp-text-sm">emails, queued so none are lost</p>
          </div>
          <div>
            <p className="hp-rel__num hp-rel__num--b">1 record</p>
            <p className="hp-text-sm">in the app for every action</p>
          </div>
          <div>
            <p className="hp-rel__num hp-rel__num--c">0</p>
            <p className="hp-text-sm">passwords to remember or leak</p>
          </div>
        </div>
      </div>

      <div className="hp-container hp-container--top0">
        <div className="hp-divider" />
        <div className="hp-rel__sub hp-title-pair hp-h-sm">
          <h3>Choose your way in.</h3>
          <p className="hp-sub">Sign in with Google or a six-digit email code, then pick the side you’re on. No passwords, ever.</p>
        </div>
        <div className="hp-paths">
          <div className="hp-path">
            <div className="hp-path__ui" aria-hidden="true">
              <span className="hp-path__radio hp-path__radio--on" />
              <span>I coach an FTC team</span>
            </div>
            <p className="hp-text-sm">
              <b>Coach a team?</b> Verify your team number, upload your deck, and start pitching approved companies.
            </p>
            <Link href={TEAM_HREF} prefetch={false} className="hp-link hp-link--sm">
              I coach a team
              <Arrow />
            </Link>
          </div>
          <div className="hp-path">
            <div className="hp-path__ui" aria-hidden="true">
              <span className="hp-path__radio hp-path__radio--on" />
              <span>I represent a company</span>
            </div>
            <p className="hp-text-sm">
              <b>Represent a company?</b> Set up your profile and questions. A reviewer approves you before teams can pitch.
            </p>
            <Link href={COMPANY_HREF} prefetch={false} className="hp-link hp-link--sm">
              I represent a company
              <Arrow />
            </Link>
          </div>
          <div className="hp-path">
            <div className="hp-path__ui hp-path__ui--code" aria-hidden="true">
              <span>4</span>
              <span>8</span>
              <span>1</span>
              <span>5</span>
              <span>0</span>
              <span className="hp-path__caret" />
            </div>
            <p className="hp-text-sm">
              <b>Already have an account?</b> Sign in and you’ll land right where you left off.
            </p>
            <Link href="/login" prefetch={false} className="hp-link hp-link--sm">
              Sign in
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* The reference's "What's happening" squeezy carousel: the active item is wide, the rest squeeze into slivers. */
export function News() {
  return (
    <section className="hp-section" aria-labelledby="hp-news-title">
      <div className="hp-container hp-container--bot0">
        <div className="hp-news__head">
          <div className="hp-h-lg">
            <h2 id="hp-news-title">What’s new</h2>
            <p className="hp-sub">The latest from FTC Pitfund.</p>
          </div>
          <div className="hp-carousel__nav hp-carousel__nav--static">
            <button type="button" className="hp-carousel__btn" data-hp-news-prev aria-label="Previous">
              <I.left />
            </button>
            <button type="button" className="hp-carousel__btn" data-hp-news-next aria-label="Next">
              <I.right />
            </button>
          </div>
        </div>
        <div className="hp-news" data-hp-news>
          <div className="hp-news__strip">
            {NEWS.map((n, i) => (
              <button key={n.title} type="button" className={`hp-news__item hp-news__art--${n.art}`} data-hp-news-item={i} data-active={i === 0 ? 'true' : 'false'}>
                <span className="hp-news__caption">{n.caption}</span>
              </button>
            ))}
          </div>
          <div className="hp-news__details">
            {NEWS.map((n, i) => (
              <div key={n.title} className="hp-news__detail" data-hp-news-detail={i} data-active={i === 0 ? 'true' : 'false'}>
                <p className="hp-text-lg">
                  <b>{n.title}</b> {n.body}
                </p>
                <Link href={n.href} prefetch={false} className="hp-btn hp-btn--sm hp-btn--secondary">
                  {n.cta}
                  <Arrow />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* The reference's "Book of the week", as a deck-writing guide. */
export function Guide() {
  const tips = [
    ['Page 1', 'Who you are: team name, number, town, and one photo of the robot.'],
    ['Page 2', 'What you did last season, in numbers: events, awards, outreach hours.'],
    ['Page 3', 'What a season costs, itemized. Round numbers are fine.'],
    ['Page 4', 'What a sponsor gets: logo placement, visits, a demo at their office.'],
    ['Page 5', 'One clear ask, and who to contact.'],
  ]
  return (
    <section className="hp-section" id="guide">
      <div className="hp-container">
        <div className="hp-divider hp-guide__rule" />
        <div className="hp-guide">
          <div className="hp-guide__cover" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '48px 32px', background: 'var(--hp-bg-3)', justifyContent: 'center' }}>
            {tips.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', background: 'var(--hp-bg-0)', padding: '16px', borderRadius: '8px', boxShadow: 'var(--hp-shadow-sm)' }}>
                <span style={{ color: 'var(--hp-brand-400)', fontWeight: 600, fontSize: '1.1rem', flexShrink: 0 }}>{k}</span>
                <span style={{ color: 'var(--hp-text-1)', fontSize: '0.9rem', lineHeight: 1.4 }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="hp-guide__body">
            <span className="hp-guide__seal" aria-hidden="true">
              <Mark />
            </span>
            <h3 className="hp-h-md">The five-page sponsorship deck</h3>
            <p className="hp-h-md hp-sub">From the FTC Pitfund reviewers</p>
            <p className="hp-text-md hp-guide__lede">
              Decks on FTC Pitfund are capped at five pages, so every page has to earn its place. The pitches that reviewers send on fastest tell one story, keeping companies engaged from start to finish.
            </p>
            <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--sm hp-btn--quiet" style={{ marginTop: '24px' }}>
              Upload your deck
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

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
