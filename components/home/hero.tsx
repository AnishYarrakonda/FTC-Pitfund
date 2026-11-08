import Link from 'next/link'

import { COMPANY_HREF, STATS, TEAM_HREF } from './content'
import { Arrow, I } from './icons'

/*
 * The hero: a dot-grid field, the headline on the left with one phrase lit in the highlight color, and
 * a still of the product on the right (markup, not an image, so it is crisp and costs no request).
 * Under it, the season's rules as a quiet strip of figures.
 */

const PITCHES: Array<[string, string, 'draft' | 'review' | 'sent' | 'matched']> = [
  ['Ribosome Robotics', 'Interested', 'matched'],
  ['Northwind Aero', 'In review', 'review'],
  ['Lumen Circuits', 'Sent', 'sent'],
  ['Harborline Labs', 'Draft', 'draft'],
]

export function Hero() {
  return (
    <section className="hp-hero" aria-labelledby="hp-hero-title">
      <div className="hp-hero__dots" aria-hidden="true" />
      <div className="hp-container hp-hero__grid">
        <div className="hp-hero__text">
          <h1 id="hp-hero-title" className="hp-hero__title">
            Sponsorship pitches <span className="hp-hl">companies actually read.</span>
          </h1>
          <p className="hp-hero__lede">
            Upload your team’s deck once, answer each sponsor’s own questions, and have every pitch checked by a real person before it lands.
          </p>
          <div className="hp-btns">
            <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--primary hp-btn--lg">
              I coach a team
              <Arrow />
            </Link>
            <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--ghost hp-btn--lg">
              I represent a company
            </Link>
          </div>
          <ul className="hp-hero__proof">
            <li>
              <I.tick />
              Free for teams and companies
            </li>
            <li>
              <I.tick />
              Every pitch human-reviewed
            </li>
            <li>
              <I.tick />
              Contacts private until a match
            </li>
          </ul>
        </div>

        <div className="hp-window hp-hero__app" role="img" aria-label="Preview of FTC Pitfund: a team’s pitch list beside a pitch a company marked Interested">
          <div className="hp-window__bar">
            <span className="hp-window__dots">
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="hp-app">
            <div className="hp-app__side">
              <span className="hp-app__new">
                <I.plus />
                New pitch
              </span>
              <span className="hp-app__nav hp-app__nav--on">Pitches</span>
              <span className="hp-app__nav">Sponsors</span>
              <span className="hp-app__nav">Team</span>
              <span className="hp-app__group">This season</span>
              {PITCHES.map(([name, , tone]) => (
                <span key={name} className="hp-app__item">
                  <i className={`hp-dot hp-dot--${tone}`} />
                  {name}
                </span>
              ))}
            </div>
            <div className="hp-app__main">
              <div className="hp-app__head">
                <span className="hp-app__logo">EX</span>
                <span>
                  <b>Exodius → Ribosome Robotics</b>
                  <small>Team 31579 · 2026–27 season</small>
                </span>
                <span className="hp-chip hp-chip--matched">Interested</span>
              </div>
              <div className="hp-app__card">
                <small>How would your team use our support this season?</small>
                <p>Machined drivetrain parts for our worlds robot, plus two summer workshops for local FLL teams.</p>
              </div>
              <div className="hp-app__deck" aria-hidden="true">
                <i className="hp-app__cover" />
                <i />
                <i />
                <i />
                <i />
              </div>
              <ol className="hp-app__steps">
                <li className="hp-is-done">Submitted</li>
                <li className="hp-is-done">Reviewed</li>
                <li className="hp-is-done">Sent</li>
                <li className="hp-is-live">Interested</li>
              </ol>
              <div className="hp-app__toast">
                <span className="hp-app__toast-icon">
                  <I.tick />
                </span>
                <span>
                  <b>Contacts shared</b>
                  <small>Both of you can see each other’s details now.</small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hp-container hp-facts">
        <p className="hp-eyebrow">Built around the season</p>
        <dl className="hp-facts__list">
          {STATS.map((s) => (
            <div key={s.value} className="hp-facts__item">
              <dt className="hp-tabular">{s.value}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
