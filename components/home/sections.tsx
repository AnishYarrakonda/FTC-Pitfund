import Link from 'next/link'
import type { ComponentType } from 'react'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'

import { CHAPTERS, COMPANY_HREF, FAQS, RULES, SHARED, SIDES } from './content'
import { Arrow, I } from './icons'
import {
  CellCompanies,
  CellMembers,
  CellNote,
  CellQuestions,
  CellSeason,
  CellShare,
  CellVerify,
  PanelComposer,
  PanelInbox,
  PanelMatched,
  PanelReview,
  PanelTeamPage,
} from './product'

/*
 * The homepage below the hero, in the reference's order: the chapters of how a pitch moves (a pinned
 * rail beside statements over product panels), a dark section on the people who check everything and
 * what is shared when, a pinned principle the dark section slides away from, the season, the two sides,
 * the FAQ and "find where to start". Static markup; effects/* wires the rail, tabs, reveals and the find box.
 */

function Tag({ children, dark }: { children: string; dark?: boolean }) {
  return <p className={`hp-tag ${dark ? 'hp-tag--dark' : ''}`}>{children}</p>
}

/** A two-tone heading: the statement, then the explanation in a quieter grey. */
function TwoTone({ lead, rest, br }: { lead: string; rest: string; br?: boolean }) {
  return (
    <>
      <span>{lead}</span>
      {' '}
      {br ? <br className="hp-br" /> : null}
      <span className="hp-dim">{rest}</span>
    </>
  )
}

const PANELS: Record<(typeof CHAPTERS)[number]['id'], { panel: ComponentType; cells?: [ComponentType, ComponentType] }> = {
  'team-page': { panel: PanelTeamPage, cells: [CellVerify, CellShare] },
  pitch: { panel: PanelComposer },
  review: { panel: PanelReview, cells: [CellNote, CellCompanies] },
  answers: { panel: PanelInbox },
  matched: { panel: PanelMatched, cells: [CellSeason, CellMembers] },
}

export function Chapters() {
  return (
    <section className="hp-ch" id="how" aria-labelledby="hp-how-title">
      <div className="hp-frame">
        <div className="hp-intro">
          <Tag>How it works</Tag>
          <h2 id="hp-how-title" className="hp-h2">
            <TwoTone br lead="One pitch, start to finish." rest="Set up once, pitch the companies that fit, and always know where each pitch stands." />
          </h2>
        </div>
        <div className="hp-ch__grid">
          <nav className="hp-rail" aria-label="How it works" data-hp-rail>
            <ol className="hp-rail__list">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="hp-rail__link" data-hp-rail-link={c.id} aria-current={i === 0 ? 'step' : undefined}>
                    <span className="hp-rail__mark" aria-hidden="true" />
                    {c.nav}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="hp-ch__list">
            {CHAPTERS.map((c) => {
              const { panel: Panel, cells: Cells } = PANELS[c.id]
              return (
                <article key={c.id} id={c.id} className="hp-chapter" data-hp-chapter={c.id} aria-labelledby={`hp-ch-${c.id}`}>
                  <div className="hp-chapter__stmt">
                    <h3 id={`hp-ch-${c.id}`} className="hp-stmt">
                      <TwoTone lead={c.lead} rest={c.rest} />
                    </h3>
                  </div>
                  <div className="hp-chapter__panel">
                    <div className="hp-chapter__fit">
                      <Panel />
                    </div>
                  </div>
                  {c.cells && Cells ? (
                    <div className="hp-chapter__cells">
                      {c.cells.map((cell, i) => {
                        const Vis = Cells[i]
                        return (
                          <div key={cell.title} className="hp-cell">
                            <div className="hp-cell__text">
                              <h4>{cell.title}</h4>
                              <p>{cell.body}</p>
                            </div>
                            <div className="hp-cell__vis">
                              <Vis />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Concentric rings for "what's shared": the public, the company you pitched, the two of you. */
function Rings() {
  return (
    <svg className="hp-rings" viewBox="0 0 520 520" aria-hidden="true" data-hp-rings>
      <defs>
        <radialGradient id="hp-rings-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.06" />
        </radialGradient>
      </defs>
      <circle cx="260" cy="260" r="250" fill="url(#hp-rings-fade)" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="260" y1="260" x2={260 + 250 * Math.cos((i * Math.PI) / 6)} y2={260 + 250 * Math.sin((i * Math.PI) / 6)} className="hp-rings__spoke" />
      ))}
      <g className="hp-rings__ring" data-ring="public">
        <circle cx="260" cy="260" r="236" />
        <text x="260" y="50">
          Anyone with the link
        </text>
      </g>
      <g className="hp-rings__ring" data-ring="pitch">
        <circle cx="260" cy="260" r="160" />
        <text x="260" y="126">
          The company you pitched
        </text>
      </g>
      <g className="hp-rings__ring" data-ring="contacts">
        <circle cx="260" cy="260" r="84" />
        <text x="260" y="202">
          You two
        </text>
      </g>
      <circle cx="260" cy="260" r="5" className="hp-rings__core" />
      <circle r="3.5" className="hp-rings__orbit hp-rings__orbit--a" />
      <circle r="3" className="hp-rings__orbit hp-rings__orbit--b" />
      <circle r="2.5" className="hp-rings__orbit hp-rings__orbit--c" />
    </svg>
  )
}

const RULE_ICONS = { user: I.user, shield: I.shield, check: I.check, lock: I.lock, flag: I.flag } as const

export function People() {
  return (
    <section className="hp-dark" aria-labelledby="hp-people-title" data-hp-tone="dark">
      <div className="hp-frame">
        <div className="hp-dark__hero" data-hp-reveal>
          <Tag dark>Checked by people</Tag>
          <h2 id="hp-people-title" className="hp-dark__title">
            Read by a person.
          </h2>
          <p className="hp-dark__sub">Every team, every company and every pitch is checked by a reviewer before it reaches anyone else.</p>
          <svg className="hp-horizon" viewBox="0 0 1400 420" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="hp-horizon-edge" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#f5b900" stopOpacity="0.2" />
                <stop offset="0.25" stopColor="#f5b900" />
                <stop offset="0.5" stopColor="#ffffff" />
                <stop offset="0.75" stopColor="#709ff5" />
                <stop offset="1" stopColor="#709ff5" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="hp-horizon-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.06" />
                <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 420 C 160 120, 480 30, 700 30 C 920 30, 1240 120, 1400 420 Z" fill="url(#hp-horizon-fill)" />
            <path className="hp-horizon__glow" d="M0 420 C 160 120, 480 30, 700 30 C 920 30, 1240 120, 1400 420" pathLength="1" />
            <path className="hp-horizon__edge" d="M0 420 C 160 120, 480 30, 700 30 C 920 30, 1240 120, 1400 420" pathLength="1" />
          </svg>
        </div>

        <ul className="hp-rules">
          {RULES.map((r) => {
            const Icon = RULE_ICONS[r.icon]
            return (
              <li key={r.title} className="hp-rules__item">
                <Icon />
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </li>
            )
          })}
        </ul>

        <div className="hp-shared" id="shared">
          <div className="hp-shared__text">
            <Tag dark>Privacy</Tag>
            <h2 className="hp-h2">
              <TwoTone lead="Nothing leaves early." rest="Here’s who sees what, and when." />
            </h2>
            <ul className="hp-shared__items" data-hp-steps>
              {SHARED.map((s, i) => (
                <li key={s.id} className="hp-shared__item" data-hp-step={s.id} data-open={i === 0 ? 'true' : 'false'}>
                  <button type="button" className="hp-shared__btn" aria-expanded={i === 0} aria-controls={`hp-shared-${s.id}`} data-hp-step-btn>
                    {s.title}
                  </button>
                  <div className="hp-shared__body" id={`hp-shared-${s.id}`}>
                    <p>{s.body}</p>
                  </div>
                  <span className="hp-shared__bar" aria-hidden="true">
                    <i />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hp-shared__art" data-hp-shared-art data-ring="public">
            <Rings />
          </div>
        </div>

        <div className="hp-forco">
          <div className="hp-forco__box">
            <h2 className="hp-h2">
              <TwoTone br lead="Sponsor robotics." rest="Without the inbox." />
            </h2>
            <p>Write your questions once. Only reviewed pitches reach you, and each one takes a click to answer.</p>
            <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--dark-outline">
              Set up your company
              <Arrow />
            </Link>
          </div>
          <svg className="hp-forco__art" viewBox="0 0 400 300" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i} transform={`translate(${60 + i * 34} ${40 + i * 26})`}>
                <path d="M0 40 L120 0 L220 40 L100 80 Z" className="hp-forco__page" />
                <circle cx="0" cy="40" r="2.5" className="hp-forco__node" />
                <circle cx="220" cy="40" r="2.5" className="hp-forco__node" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  )
}

const PRINCIPLE = 'Every pitch is read by a person before a company sees it. Nothing about your team is shared until someone on the other side says yes.'

export function Principle() {
  return (
    <section className="hp-principle" aria-labelledby="hp-principle-title">
      <div className="hp-principle__pin">
        <div className="hp-frame hp-principle__frame">
          <h2 id="hp-principle-title" className="hp-sr">
            How FTC Pitfund works
          </h2>
          <p className="hp-quote" data-hp-quote>
            {PRINCIPLE.split(' ').map((w, i) => (
              <span key={i}>{w} </span>
            ))}
          </p>
          <p className="hp-quote__by">
            <b>The rule FTC Pitfund is built on</b>
            <span>Run by FTC Team 31579 Exodius</span>
          </p>
        </div>
      </div>
    </section>
  )
}

export function Season() {
  return (
    <section className="hp-season" id="season" aria-labelledby="hp-season-title">
      <div className="hp-frame hp-season__frame">
        <div className="hp-season__text">
          <Tag>The season</Tag>
          <h2 id="hp-season-title" className="hp-h2">
            <TwoTone br lead="One pitch per company." rest="Every season, from September 1." />
          </h2>
          <p className="hp-season__body">Withdraw a pitch before the company answers and the slot is yours again. A new season opens every year.</p>
        </div>
        <svg className="hp-season__curve" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true" data-hp-reveal>
          <path d="M0 540 C 420 540, 760 420, 1000 20" className="hp-season__path" />
        </svg>
        <ol className="hp-season__marks" aria-label="The season">
          <li style={{ ['--x' as string]: '7.5%', ['--y' as string]: '96.8%' }}>
            <b>Sept 1</b> Season opens
          </li>
          <li style={{ ['--x' as string]: '51.7%', ['--y' as string]: '83.8%' }}>
            <b>Pitch</b> One per company
          </li>
          <li style={{ ['--x' as string]: '77.5%', ['--y' as string]: '59.9%' }}>
            <b>Reviewed</b> Read by a person
          </li>
          <li className="is-flip" style={{ ['--x' as string]: '94.8%', ['--y' as string]: '30.8%' }}>
            <b>Aug 31</b> Season closes
          </li>
        </ol>
      </div>
    </section>
  )
}

const SIDE_VISUALS = { teams: CellShare, companies: CellQuestions } as const

export function Sides() {
  return (
    <section className="hp-sides" id="sides" aria-labelledby="hp-sides-title">
      <div className="hp-frame">
        <div className="hp-intro hp-intro--row">
          <div>
            <Tag>Two sides</Tag>
            <h2 id="hp-sides-title" className="hp-h2">
              <TwoTone br lead="Built for both sides of a sponsorship." rest="Coaches pitch. Companies answer." />
            </h2>
          </div>
          <a href="#faq" className="hp-btn hp-btn--outline hp-btn--sm">
            Read the FAQ
            <Arrow />
          </a>
        </div>
        <div className="hp-sides__tabs" role="tablist" aria-label="Who it’s for" data-hp-tabs="sides">
          {SIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`hp-side-tab-${s.id}`}
              aria-selected={i === 0}
              aria-controls={`hp-side-panel-${s.id}`}
              tabIndex={i === 0 ? 0 : -1}
              className="hp-sides__tab"
              data-hp-tab={s.id}
            >
              {s.tab}
            </button>
          ))}
        </div>
        {SIDES.map((s, i) => {
          const Vis = SIDE_VISUALS[s.id]
          return (
            <div key={s.id} id={`hp-side-panel-${s.id}`} role="tabpanel" aria-labelledby={`hp-side-tab-${s.id}`} className="hp-sides__panel" hidden={i !== 0} data-hp-panel={s.id}>
              <div className="hp-sides__text">
                <p className="hp-overline">{s.overline}</p>
                <h3 className="hp-stmt">
                  <TwoTone br lead={s.lead} rest={s.rest} />
                </h3>
                <ul className="hp-checks">
                  {s.checks.map((c) => (
                    <li key={c}>
                      <I.check />
                      {c}
                    </li>
                  ))}
                </ul>
                <Link href={s.cta.href} prefetch={false} className="hp-btn hp-btn--primary">
                  {s.cta.label}
                  <Arrow />
                </Link>
              </div>
              <div className="hp-sides__vis">
                <Vis />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function Faq() {
  return (
    <section className="hp-faq" id="faq" aria-labelledby="hp-faq-title">
      <div className="hp-frame hp-faq__frame">
        <div className="hp-faq__head">
          <Tag>FAQ</Tag>
          <h2 id="hp-faq-title" className="hp-h2">
            <TwoTone br lead="Questions, answered." rest="Ask us anything else." />
          </h2>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hp-btn hp-btn--outline hp-btn--sm">
            Email {SUPPORT_EMAIL}
          </a>
        </div>
        <div className="hp-faq__list">
          {FAQS.map((f) => (
            <details key={f.id} className="hp-faq__item" id={`faq-${f.id}`}>
              <summary>
                <span>{f.q}</span>
                <I.plus />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* "Find where to start": a box that routes what a visitor types to the right door (effects/sections.ts). */
export function FindPath() {
  const chips = ['I coach a team', 'I represent a company', 'How does review work?', 'Is it free?']
  return (
    <section className="hp-find" id="find" aria-labelledby="hp-find-title">
      <div className="hp-frame hp-find__frame">
        <h2 id="hp-find-title" className="hp-find__title">
          <TwoTone br lead="Not sure where to start?" rest="Tell us who you are." />
        </h2>
        <div className="hp-find__side">
          <form className="hp-find__form" data-hp-find action="/login" method="get">
            <label htmlFor="hp-find-input" className="hp-sr">
              Who are you, or what do you need?
            </label>
            <input id="hp-find-input" name="q" type="text" maxLength={500} autoComplete="off" placeholder="I coach a team in Ohio…" data-hp-find-input />
            <button type="submit" className="hp-btn hp-btn--primary">
              Find my way in
            </button>
          </form>
          <div className="hp-find__chips">
            {chips.map((c) => (
              <button key={c} type="button" className="hp-find__chip" data-hp-chip={c}>
                {c}
              </button>
            ))}
          </div>
          <div className="hp-find__answer" data-hp-find-answer role="status" aria-live="polite" />
          <p className="hp-find__legal">
            Nothing you type is stored or sent anywhere; it only picks a link. See our{' '}
            <Link href="/legal/privacy" prefetch={false}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
