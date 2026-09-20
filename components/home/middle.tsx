import Link from 'next/link'

import { STATS } from './content'
import { I } from './icons'

/* "Get product recommendations": a gradient-bordered box that routes a visitor to the right door. */
export function FindPath() {
  const chips = ['I coach a team', 'I represent a company', 'How does review work?', 'Is it free?']
  return (
    <section className="hp-section" id="find" aria-labelledby="hp-find-title">
      <div className="hp-container hp-find">
        <h2 id="hp-find-title" className="hp-h-md">
          Find where to start
        </h2>
        <p className="hp-text-lg hp-find__lede">Tell us who you are or what you need, and we’ll point you to the right place.</p>
        <form className="hp-find__box" data-hp-find action="/login" method="get">
          <label htmlFor="hp-find-input" className="hp-sr">
            Who are you, or what do you need?
          </label>
          <textarea id="hp-find-input" name="q" rows={3} maxLength={500} placeholder="I coach a team in Ohio and we need help paying for a field kit…" data-hp-find-input />
          <div className="hp-find__row">
            <span className="hp-find__strength" aria-hidden="true">
              <span data-hp-find-ring />
            </span>
            <span className="hp-find__label">Try:</span>
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
/*
 * "The backbone of global commerce": a centered title, four stats that act as a menu (the active one
 * is ink, the rest quiet; a gradient hairline slides above and below the active one)
 */
export function Stats() {
  return (
    <section className="hp-section hp-stats" data-hp-stats aria-labelledby="hp-stats-title">
      <div className="hp-container hp-stats__container">
        <h2 id="hp-stats-title" className="hp-h-xxl hp-stats__title">
          Built around the rules of the season
        </h2>
        <div className="hp-stats__menu" role="tablist" aria-label="Season rules">
          <span className="hp-stats__indicator hp-stats__indicator--top" aria-hidden="true" />
          <span className="hp-stats__indicator hp-stats__indicator--bottom" aria-hidden="true" />
          {STATS.map((s, i) => (
            <button key={s.value} type="button" role="tab" className="hp-stats__stat" data-hp-stat={i} aria-selected={i === 0}>
              <span className="hp-stats__value hp-tabular">{s.value}</span>
              <span className="hp-stats__label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

