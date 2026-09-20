import type { ComponentType } from 'react'

import { MatchGraphic, PitchGraphic, PublicGraphic, QuestionsGraphic, ReviewGraphic, VerifiedGraphic } from './bento-graphics'
import { type BentoKey, SHORT } from './content'
import { I } from './icons'

/*
 * The reference's "Flexible solutions" bento. Each card is a button: hovering grows it a few pixels, draws a
 * gradient border that follows the pointer, and fills the corner expand icon; clicking opens a large
 * dialog with the full story. The dialogs are built on first open from content.ts (effects/dialogs.ts),
 * so the page doesn't ship their markup up front.
 */

const CARDS: Array<{ key: BentoKey; className: string; Graphic: ComponentType }> = [
  { key: 'pitch', className: 'hp-bento__card--pitch', Graphic: PitchGraphic },
  { key: 'questions', className: 'hp-bento__card--questions', Graphic: QuestionsGraphic },
  { key: 'review', className: 'hp-bento__card--review', Graphic: ReviewGraphic },
  { key: 'verified', className: 'hp-bento__card--verified', Graphic: VerifiedGraphic },
  { key: 'public', className: 'hp-bento__card--public', Graphic: PublicGraphic },
  { key: 'match', className: 'hp-bento__card--match', Graphic: MatchGraphic },
]


export function Bento() {
  return (
    <section className="hp-section hp-section--subdued hp-bento-section" aria-labelledby="hp-bento-title" id="product">
      <div className="hp-container">
        <div className="hp-section-title hp-title-pair hp-h-lg">
          <h2 id="hp-bento-title">One place for the whole sponsorship season.</h2>
          <p className="hp-sub">Everything a team needs to pitch and everything a company needs to say yes, designed to work on its own or together.</p>
        </div>

        <div className="hp-bento">
          {CARDS.map(({ key, className, Graphic }) => (
            <button key={key} type="button" id={`bento-${key}`} className={`hp-bento__card ${className}`} data-hp-bento={key} aria-haspopup="dialog">
              <span className="hp-bento__border" aria-hidden="true">
                <span className="hp-bento__border-glow" />
              </span>
              <span className="hp-bento__inner">
                <Graphic />
              </span>
              <span className="hp-bento__text">
                <h3 className="hp-h-md">{SHORT[key]}</h3>
              </span>
              <span className="hp-bento__entry" aria-hidden="true">
                <I.expand />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
