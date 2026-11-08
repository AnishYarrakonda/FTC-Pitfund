import Image from 'next/image'
import Link from 'next/link'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'

import { FAQS, FEATURES, SIDES, STAGES } from './content'
import { Arrow, I } from './icons'

/*
 * The homepage below the hero, top to bottom: the feature grid, how a pitch moves (a light panel with
 * the four-stage loop, then the stages one at a time), the two sides, working as a team, "find where
 * to start", and the FAQ. Every section is static markup; effects/* wires the accordion and the find box.
 */

function Eyebrow({ icon: Icon, children }: { icon?: (typeof I)[keyof typeof I]; children: string }) {
  return (
    <p className="hp-eyebrow">
      {Icon ? <Icon /> : null}
      {children}
    </p>
  )
}

export function Features() {
  return (
    <section className="hp-section" id="features" aria-labelledby="hp-features-title">
      <div className="hp-container">
        <div className="hp-shead">
          <Eyebrow icon={I.grid}>What’s inside</Eyebrow>
          <h2 id="hp-features-title" className="hp-h2">
            One place for the whole sponsorship season.
          </h2>
          <p className="hp-shead__lede">Everything a team needs to pitch and everything a company needs to say yes.</p>
        </div>
        <ul className="hp-cards">
          {FEATURES.map((f) => {
            const Icon = I[f.icon]
            return (
              <li key={f.id} id={`feature-${f.id}`} className="hp-card">
                <span className="hp-card__icon">
                  <Icon />
                </span>
                <h3 className="hp-card__title">{f.title}</h3>
                <p className="hp-card__body">{f.body}</p>
                <span className="hp-tag">{f.tag}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/* The four stages as points on a loop, the live one filled. Decoration: the list beside it says the same. */
function StageLoop() {
  const pts: Array<[number, number, string, 'start' | 'end' | 'middle']> = [
    [160, 36, 'Draft', 'middle'],
    [284, 160, 'Review', 'start'],
    [160, 284, 'Sent', 'middle'],
    [36, 160, 'Matched', 'end'],
  ]
  return (
    <svg className="hp-loop" viewBox="-40 0 400 320" aria-hidden="true">
      <circle cx="160" cy="160" r="124" className="hp-loop__ring" />
      <circle cx="160" cy="160" r="84" className="hp-loop__ring hp-loop__ring--inner" />
      <path d="M160 36 A124 124 0 0 1 284 160 A124 124 0 0 1 160 284 A124 124 0 0 1 36 160" className="hp-loop__path" />
      {pts.map(([x, y, label, anchor], i) => (
        <g key={label}>
          {i === 3 ? <circle cx={x} cy={y} r={15} className="hp-loop__halo" /> : null}
          <circle cx={x} cy={y} r={i === 3 ? 8 : 6} className="hp-loop__node" />
          <text
            x={anchor === 'start' ? x + 18 : anchor === 'end' ? x - 18 : x}
            y={i === 0 ? y - 18 : i === 2 ? y + 30 : y + 5}
            textAnchor={anchor}
            className="hp-loop__label"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function HowItWorks() {
  return (
    <section className="hp-section" id="how" aria-labelledby="hp-how-title">
      <div className="hp-container">
        <div className="hp-panel">
          <div className="hp-panel__text">
            <Eyebrow icon={I.loop}>How a pitch moves</Eyebrow>
            <h2 id="hp-how-title" className="hp-h2">
              From draft to matched, in four stages.
            </h2>
            <p>
              Write the pitch against the company’s own questions, a reviewer reads it, the company sees it, and the company answers. You always know which stage it is in.
            </p>
            <Link href="/login?intent=team" prefetch={false} className="hp-btn hp-btn--inverse">
              Start your team’s pitch
              <Arrow />
            </Link>
          </div>
          <StageLoop />
        </div>

        <div className="hp-stories" data-hp-accordion>
          {STAGES.map((s, i) => (
            <div key={s.key} className="hp-story" data-open={i === 0 ? 'true' : 'false'}>
              <button type="button" className="hp-story__summary" aria-expanded={i === 0} aria-controls={`hp-story-${s.key}`} data-hp-story>
                <span className="hp-story__num hp-tabular">0{i + 1}</span>
                <span className="hp-story__mark" style={{ color: s.color }} aria-hidden="true">
                  ●
                </span>
                <span className="hp-story__title">{s.title}</span>
                <span className="hp-story__toggle" aria-hidden="true">
                  <I.plus />
                </span>
              </button>
              <div className="hp-story__content" id={`hp-story-${s.key}`} role="region" aria-label={s.title}>
                <div className="hp-story__inner">
                  <div className="hp-story__image">
                    <Image src={s.image} alt={s.alt} width={1232} height={520} sizes="(min-width: 1180px) 760px, 100vw" loading="lazy" />
                  </div>
                  <dl className="hp-story__data">
                    {s.data.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Sides() {
  return (
    <section className="hp-section" aria-labelledby="hp-sides-title">
      <div className="hp-container">
        <div className="hp-shead">
          <Eyebrow icon={I.users}>Two sides, one season</Eyebrow>
          <h2 id="hp-sides-title" className="hp-h2">
            Built for both sides of a sponsorship.
          </h2>
          <p className="hp-shead__lede">Coaches and companies each get a workspace shaped around what they actually do.</p>
        </div>
        <div className="hp-sides">
          {SIDES.map((s) => (
            <div key={s.id} id={s.id} className="hp-window hp-side">
              <div className="hp-window__bar">
                <span className="hp-window__dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="hp-window__title">{s.label}</span>
              </div>
              <div className="hp-side__body">
                <h3 className="hp-h3">{s.title}</h3>
                <p className="hp-side__lede">{s.body}</p>
                <ul className="hp-checks">
                  {s.checks.map((c) => (
                    <li key={c}>
                      <I.tick />
                      {c}
                    </li>
                  ))}
                </ul>
                <Link href={s.cta.href} prefetch={false} className="hp-btn hp-btn--primary">
                  {s.cta.label}
                  <Arrow />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const TEAMWORK = [
  { icon: I.users, title: 'One shared account', body: 'A team or company is one account. Everyone on it works from the same pitches and the same inbox.' },
  { icon: I.user, title: 'An owner and editors', body: 'One owner invites, removes and hands ownership on. Editors can do everything else.' },
  { icon: I.mail, title: 'Nothing fails silently', body: 'Every action writes an in-app notification. Email is a copy, queued and rate-limited, never the only record.' },
  { icon: I.eye, title: 'Review notes', body: 'When a pitch needs work, a reviewer sends it back with a note on exactly what to fix.' },
  { icon: I.flag, title: 'Report a page', body: 'Anyone can report a team page, and a reviewer takes down anything that shouldn’t be there.' },
  { icon: I.question, title: 'Real support', body: `Write to ${SUPPORT_EMAIL} and a person on the team answers, usually the same day.` },
]

export function Teamwork() {
  return (
    <section className="hp-section" aria-labelledby="hp-team-title">
      <div className="hp-container">
        <div className="hp-shead">
          <Eyebrow icon={I.bolt}>Run it together</Eyebrow>
          <h2 id="hp-team-title" className="hp-h2">
            Run sponsorship as a team, not a spreadsheet.
          </h2>
        </div>
        <ul className="hp-grid3">
          {TEAMWORK.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon />
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* "Find where to start": a prompt box that routes what a visitor types to the right door (effects/sections.ts). */
export function FindPath() {
  const chips = ['I coach a team', 'I represent a company', 'How does review work?', 'Is it free?']
  return (
    <section className="hp-section" id="find" aria-labelledby="hp-find-title">
      <div className="hp-container hp-find">
        <Eyebrow icon={I.sparkle}>Not sure where to start?</Eyebrow>
        <h2 id="hp-find-title" className="hp-h2">
          Find where to start
        </h2>
        <form className="hp-find__box" data-hp-find action="/login" method="get">
          <label htmlFor="hp-find-input" className="hp-sr">
            Who are you, or what do you need?
          </label>
          <textarea id="hp-find-input" name="q" rows={3} maxLength={500} placeholder="I coach a team in Ohio and we need help paying for a field kit…" data-hp-find-input />
          <div className="hp-find__row">
            <span className="hp-find__strength" aria-hidden="true">
              <span data-hp-find-ring />
            </span>
            <div className="hp-find__chips">
              {chips.map((c) => (
                <button key={c} type="button" className="hp-find__chip" data-hp-chip={c}>
                  {c}
                </button>
              ))}
            </div>
            <span className="hp-find__count hp-tabular" data-hp-find-count>
              0/500
            </span>
            <button type="submit" className="hp-find__send" aria-label="Find my path">
              <I.up />
            </button>
          </div>
        </form>
        <div className="hp-find__answer" data-hp-find-answer role="status" aria-live="polite" />
        <p className="hp-find__legal">
          Nothing you type here is stored or sent anywhere; it only picks a link. See our{' '}
          <Link href="/legal/privacy" prefetch={false}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

export function Faq() {
  return (
    <section className="hp-section" id="faq" aria-labelledby="hp-faq-title">
      <div className="hp-container hp-faq">
        <div>
          <Eyebrow icon={I.question}>FAQ</Eyebrow>
          <h2 id="hp-faq-title" className="hp-h2">
            Questions, answered.
          </h2>
          <p className="hp-shead__lede">
            Something else? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hp-inline-link">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
        <div className="hp-faq__list">
          {FAQS.map((f) => (
            <details key={f.id} className="hp-faq__item" id={`faq-${f.id}`}>
              <summary>
                {f.q}
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
