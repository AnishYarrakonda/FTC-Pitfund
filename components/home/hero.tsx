import Link from 'next/link'

import { COMPANY_HREF, STATS, TEAM_HREF } from './content'
import { Arrow, Chevron } from './icons'
import { HeroApp, HeroInbox, HeroQueue, HeroTeamPage } from './product'

/*
 * The hero, built like the reference's: the headline pins under the head while the product window
 * scrolls up over it and the headline blurs away (effects/scroll.ts). Behind both, a pinned lavender
 * field with a fine line texture; a white cap over its top shrinks as you scroll, opening the color.
 * Three satellite windows float around the main one and settle back a little as it rises.
 * Under the hero, the season's rules as a hairline strip of figures.
 */

export function Hero() {
  return (
    <section className="hp-hero" aria-labelledby="hp-hero-title" data-hp-hero>
      <div className="hp-hero__field" aria-hidden="true">
        <div className="hp-hero__glow" />
        <div className="hp-hero__lines" />
        <div className="hp-hero__cap" data-hp-cap />
      </div>

      <div className="hp-hero__content">
        <div className="hp-hero__text" data-hp-hero-text>
          <a href="#how" className="hp-pill">
            <span>Every pitch is read by a person first</span>
            <Chevron />
          </a>
          <h1 id="hp-hero-title" className="hp-hero__title">
            Sponsorship pitches companies actually read.
          </h1>
          <p className="hp-hero__lede">FIRST® Tech Challenge teams pitch companies that already sponsor robotics, answering each one’s own questions.</p>
          <div className="hp-hero__btns">
            <Link href={COMPANY_HREF} prefetch={false} className="hp-btn hp-btn--outline">
              I represent a company
            </Link>
            <Link href={TEAM_HREF} prefetch={false} className="hp-btn hp-btn--primary">
              I coach a team
              <Arrow />
            </Link>
          </div>
        </div>

        <div className="hp-hero__stage">
          <div className="hp-hero__win" data-hp-hero-win>
            <HeroApp />
            <div className="hp-sat hp-sat--tl" data-hp-sat>
              <HeroInbox />
            </div>
            <div className="hp-sat hp-sat--bl" data-hp-sat>
              <HeroQueue />
            </div>
            <div className="hp-sat hp-sat--r" data-hp-sat>
              <HeroTeamPage />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Stats() {
  return (
    <section className="hp-stats" aria-label="The season’s rules">
      <div className="hp-frame">
        <dl className="hp-stats__grid">
          {STATS.map((s) => (
            <div key={s.value} className="hp-stats__cell">
              <dt className="hp-tabular">{s.value}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
