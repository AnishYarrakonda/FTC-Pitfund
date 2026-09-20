import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { COMPANY_HREF, FAQS, STAGES, TEAM_HREF } from './content'
import { Arrow, I } from './icons'

/*
 * "Powering businesses of all sizes": three audience blocks in the reference's order and form.
 *  1. Enterprise → teams: header row, then a sticky accordion (one open at a time, dashed dividers,
 *     image + three facts in the open row) and a three-up "experts" row.
 *  2. Startups → companies: header row, a card carousel whose cards widen on hover, two program cards.
 *  3. Platforms → the whole team: header row, a striated light panel with product UI floating over it,
 *     three features, and a quote carousel (here, the FAQ) with a sliding selection bar.
 */

function SectionHeader({ title, body, cta }: { title: string; body: string; cta: { label: string; href: string } }) {
  return (
    <div className="hp-shead">
      <div className="hp-shead__primary">
        <h3 className="hp-h-md">{title}</h3>
        <div>
          <Link href={cta.href} prefetch={false} className="hp-btn hp-btn--primary">
            {cta.label}
            <Arrow />
          </Link>
        </div>
      </div>
      <p className="hp-text-lg hp-shead__desc">{body}</p>
    </div>
  )
}

export function Audiences() {
  return (
    <section className="hp-section" aria-labelledby="hp-aud-title" id="stages">
      <div className="hp-container hp-container--bot0">
        <div className="hp-section-title hp-section-title--7 hp-title-pair hp-h-lg">
          <h2 id="hp-aud-title">Built for both sides of a sponsorship.</h2>
          <p className="hp-sub">Coaches and companies each get a workspace shaped around what they actually do.</p>
        </div>
      </div>

      {/* 1 · Teams */}
      <div className="hp-container hp-container--bot0 hp-aud">
        <div className="hp-divider" />
        <SectionHeader
          title="Pitch every approved sponsor from one team account"
          body="Verify your team once, upload one deck, and every approved company is a pitch away. Each pitch goes through the same four stages, and you can see exactly where it is."
          cta={{ label: 'I coach a team', href: TEAM_HREF }}
        />
        <div className="hp-stories" data-hp-accordion>
          {STAGES.map((s, i) => (
            <div key={s.key} className="hp-story" style={{ ['--idx' as string]: i }} data-open={i === 0 ? 'true' : 'false'}>
              <button type="button" className="hp-story__summary hp-hover" aria-expanded={i === 0} aria-controls={`hp-story-${s.key}`} data-hp-story>
                <span className="hp-story__logo" style={{ background: s.color }}>
                  {s.mark}
                </span>
                <span className="hp-story__title hp-h-sm">{s.title}</span>
                <span className="hp-story__toggle" aria-hidden="true">
                  <I.plus />
                </span>
              </button>
              <div className="hp-story__content" id={`hp-story-${s.key}`} role="region">
                <div className="hp-story__content-inner">
                  <div className={`hp-story__image hp-story__image--${s.key}`}>
                    <Image
                      className="hp-story__shot" src={s.image} alt={s.alt} width={1232} height={520} sizes="(min-width: 1280px) 1232px, 100vw" loading="lazy" />
                  </div>
                  <div className="hp-story__data">
                    {s.data.map(([k, v]) => (
                      <p key={k}>
                        <b>{k}</b> {v}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hp-experts">
          <h3 className="hp-h-md">Help from real people, when you need it</h3>
          <div className="hp-features">
            <Feature icon={<I.eye />} title="Review notes." body="When a pitch needs work, a reviewer sends it back with a note on exactly what to fix." link={{ label: 'How review works', href: '#bento-review' }} />
            <Feature icon={<I.mail />} title="Email support." body="Write to ftcexodius@gmail.com and a person on the team answers, usually the same day." link={{ label: 'Email us', href: 'mailto:ftcexodius@gmail.com' }} />
            <Feature icon={<I.flag />} title="Report a page." body="Anyone can report a team page. A reviewer looks at every report and takes down anything that shouldn’t be there." link={{ label: 'Read the rules', href: '/legal/terms' }} />
          </div>
        </div>
      </div>

      {/* 2 · Companies */}
      <div className="hp-container hp-container--bot0 hp-aud" id="companies">
        <div className="hp-divider" />
        <SectionHeader
          title="Give your company an inbox of screened, specific pitches"
          body="Write the questions you care about and let approved teams answer them. Every pitch is read by a reviewer before it reaches you, and you answer each one with a click."
          cta={{ label: 'Set up your company', href: COMPANY_HREF }}
        />

        <div className="hp-programs">
          <ProgramCard title="For company owners." body="Set up the company, write its questions, and invite colleagues as editors. You stay the owner until you hand it on." href={COMPANY_HREF} cta="Set up your company" tone="a" />
          <ProgramCard title="For team owners." body="Create the team account, verify it once, and invite the other coaches and mentors who help with sponsorship." href={TEAM_HREF} cta="Create your team" tone="b" />
        </div>
      </div>

      {/* 3 · The whole team */}
      <div className="hp-container hp-aud">
        <div className="hp-divider" />
        <SectionHeader
          title="Run sponsorship as a team, not a spreadsheet"
          body="Every coach, mentor or colleague on the account sees the same pitches, the same notes and the same answers. One owner, any number of editors, and a notification for everything."
          cta={{ label: 'See a pitch move', href: '#stages' }}
        />
        <div className="hp-platform" aria-hidden="true">
          <div className="hp-platform__light" />
          <div className="hp-platform__ui">
            <div className="hp-pui hp-pui--members">
              <p className="hp-pui__title">Members</p>
              <p className="hp-pui__sub">Owners invite, remove and hand ownership on.</p>
              <div className="hp-pui__row">
                <span className="hp-pui__av" style={{ background: '#1e40af' }}>JP</span>Jordan Park<em>Owner</em>
              </div>
              <div className="hp-pui__row">
                <span className="hp-pui__av" style={{ background: '#047857' }}>MC</span>Maya Chen<em>Editor</em>
              </div>
              <div className="hp-pui__row">
                <span className="hp-pui__av" style={{ background: '#00805f' }}>SR</span>Sam Rivera<em>Editor</em>
              </div>
              <code>Invite by email · link expires in 7 days</code>
            </div>
            <div className="hp-pui hp-pui--table">
              <p className="hp-pui__title">Pitches</p>
              <div className="hp-pui__grid hp-pui__grid--head">
                <span>Company</span>
                <span>Status</span>
                <span>Updated</span>
              </div>
              {[
                ['BioBuzz Foundation', 'Matched', 'ok', 'Sep 12'],
                ['Northwind Aero', 'In review', 'mid', 'Sep 15'],
                ['Lumen Circuits', 'Sent', 'mid', 'Sep 16'],
                ['Harborline Labs', 'Draft', 'draft', 'Sep 18'],
                ['Summit Machining', 'Not a fit', 'no', 'Sep 02'],
              ].map(([n, s, t, d]) => (
                <div key={n} className="hp-pui__grid">
                  <span>{n}</span>
                  <span>
                    <i className={`hp-g-pill hp-g-pill--${t}`}>{s}</i>
                  </span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
            <div className="hp-pui hp-pui--note">
              <p className="hp-pui__title">Notification</p>
              <p className="hp-pui__sub">BioBuzz Foundation said Interested. Their contacts are on the pitch.</p>
              <code>Emailed a copy to 3 members</code>
            </div>
          </div>
        </div>
        <div className="hp-features">
          <Feature icon={<I.users />} title="One shared account." body="A team or company is one account. Everyone on it works from the same pitches and the same inbox." link={{ label: 'I coach a team', href: TEAM_HREF }} />
          <Feature icon={<I.user />} title="Owner and editors." body="One owner invites, removes and hands ownership on. Editors can do everything else." link={{ label: 'Read the FAQ', href: '#faq' }} />
          <Feature icon={<I.mail />} title="Nothing fails silently." body="Every action writes an in-app notification. Email is a copy, queued and rate-limited, never the only record." link={{ label: 'How it’s built', href: '#reliable' }} />
        </div>

        <div className="hp-quotes" id="faq" data-hp-quotes>
          <h3 className="hp-sr">Frequently asked questions</h3>
          <div className="hp-quotes__cards" data-hp-quote-track tabIndex={-1}>
            {FAQS.map((f, i) => (
              <div key={f.id} className="hp-quote" id={`hp-faq-${f.id}`} role="tabpanel" aria-labelledby={`hp-faq-tab-${f.id}`} data-active={i === 0 ? 'true' : 'false'}>
                <span className="hp-quote__mark" aria-hidden="true">
                  <I.question />
                </span>
                <blockquote className="hp-quote__text">{f.a}</blockquote>
                <p className="hp-quote__who">
                  <b>FTC Pitfund FAQ</b>
                  <span>
                    Question {i + 1} of {FAQS.length}
                  </span>
                </p>
              </div>
            ))}
          </div>
          <div className="hp-quotes__nav" role="tablist" aria-label="Questions">
            <span className="hp-quotes__rail" aria-hidden="true" />
            <span className="hp-quotes__bar" aria-hidden="true" />
            {FAQS.map((f, i) => (
              <button key={f.id} type="button" role="tab" id={`hp-faq-tab-${f.id}`} aria-controls={`hp-faq-${f.id}`} aria-selected={i === 0} className="hp-quotes__tab" data-hp-quote={i}>
                {f.q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Feature({ icon, title, body, link }: { icon: ReactNode; title: string; body: string; link: { label: string; href: string } }) {
  return (
    <div className="hp-feature">
      <span className="hp-charm">{icon}</span>
      <p className="hp-text-md hp-feature__body">
        <b>{title}</b> {body}
      </p>
      <Link href={link.href} prefetch={false} className="hp-link">
        {link.label}
        <Arrow />
      </Link>
    </div>
  )
}

function ProgramCard({ title, body, href, cta, tone }: { title: string; body: string; href: string; cta: string; tone: 'a' | 'b' }) {
  return (
    <Link href={href} prefetch={false} className={`hp-program hp-program--${tone} hp-hover`}>
      <span className="hp-program__shape" aria-hidden="true" />
      <p className="hp-program__text">
        <b>{title}</b> {body}
      </p>
      <span className="hp-link">
        {cta}
        <Arrow />
      </span>
    </Link>
  )
}
