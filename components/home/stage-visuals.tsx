import type { ReactNode } from 'react'

import { I } from './icons'

/*
 * The four stage panels under "How a pitch moves". Each is a small, simplified piece of the product
 * drawn in markup (not a screenshot), so it stays sharp at any size and on-theme. Decoration: the
 * stage title and figures beside it say the same thing in words.
 */

function Frame({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div className="hp-window hp-sv" role="img" aria-label={label}>
      <div className="hp-window__bar">
        <span className="hp-window__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="hp-window__title">{title}</span>
      </div>
      <div className="hp-sv__body">{children}</div>
    </div>
  )
}

function TeamPage() {
  return (
    <Frame label="A team page: logo, name, team number, one-line summary and a five-page sponsorship deck" title="Team page · Exodius">
      <div className="hp-sv__team">
        <span className="hp-sv__logo">EX</span>
        <div className="hp-sv__team-text">
          <p className="hp-sv__name">
            Exodius <I.check className="hp-sv__verified" />
          </p>
          <p className="hp-sv__meta">Team 31579 · Austin, TX</p>
        </div>
      </div>
      <p className="hp-sv__summary">Third-year community team building a reliable robot and running free workshops for local students.</p>
      <div className="hp-sv__deck">
        <i className="hp-sv__page hp-sv__page--cover" />
        <i className="hp-sv__page" />
        <i className="hp-sv__page" />
        <i className="hp-sv__page" />
        <i className="hp-sv__page hp-sv__page--empty" />
      </div>
      <div className="hp-sv__row">
        <span className="hp-sv__meta">Sponsorship deck · 4 of 5 pages · 2.1 MB</span>
        <span className="hp-chip hp-chip--neutral">Used in 6 pitches</span>
      </div>
    </Frame>
  )
}

function Review() {
  return (
    <Frame label="A reviewer's checklist for a pitch, with a note asking the team to add numbers before it is sent" title="Review · Exodius → Ribosome Robotics">
      <ul className="hp-sv__checks">
        <li>
          <I.tick className="hp-sv__ok" />
          Every question answered
        </li>
        <li>
          <I.tick className="hp-sv__ok" />
          Deck attached and readable
        </li>
        <li>
          <I.tick className="hp-sv__ok" />
          Team verified against FIRST
        </li>
        <li className="hp-sv__flag">
          <I.flag />
          Question 3 needs rough numbers
        </li>
      </ul>
      <div className="hp-sv__note">
        <span className="hp-sv__label">Note to the team</span>
        <p>Add a rough cost for the field kit so Ribosome can size its support.</p>
      </div>
      <div className="hp-sv__actions">
        <span className="hp-sv__btn">Send back with note</span>
        <span className="hp-sv__btn hp-sv__btn--primary">Approve and send</span>
      </div>
    </Frame>
  )
}

function Questions() {
  return (
    <Frame label="A pitch being written against a company's own questions, three of four answered and saved" title="Pitch · Ribosome Robotics">
      <div className="hp-sv__row">
        <span className="hp-sv__meta">3 of 4 answered</span>
        <span className="hp-sv__saved">
          <I.tick />
          Saved
        </span>
      </div>
      <div className="hp-sv__progress">
        <i style={{ width: '75%' }} />
      </div>
      <ol className="hp-sv__qs">
        <li className="hp-sv__q--done">How did your team start, and who runs it?</li>
        <li className="hp-sv__q--done">How many students are on the team?</li>
        <li className="hp-sv__q--done">What does a season cost you?</li>
        <li className="hp-sv__q--active">
          How would our support change your season?
          <span className="hp-sv__field">
            A machined drivetrain for worlds, and two summer workshops
            <span className="hp-sv__caret" />
          </span>
        </li>
      </ol>
    </Frame>
  )
}

function Match() {
  return (
    <Frame label="A company marks a pitch Interested and both sides see each other's contact details" title="Inbox · Ribosome Robotics">
      <div className="hp-sv__team">
        <span className="hp-sv__logo">EX</span>
        <div className="hp-sv__team-text">
          <p className="hp-sv__name">Exodius</p>
          <p className="hp-sv__meta">Reviewed pitch · Team 31579</p>
        </div>
      </div>
      <div className="hp-sv__actions hp-sv__actions--split">
        <span className="hp-sv__btn hp-sv__btn--chosen">
          <I.tick />
          Interested
        </span>
        <span className="hp-sv__btn">Not a fit</span>
      </div>
      <div className="hp-sv__contact">
        <span className="hp-sv__label">Contacts, now shared</span>
        <div className="hp-sv__person">
          <span className="hp-sv__avatar">JP</span>
          <span className="hp-sv__team-text">
            <span className="hp-sv__name">Jordan Park</span>
            <span className="hp-sv__meta">Head coach · coach@exodius.example</span>
          </span>
        </div>
        <div className="hp-sv__person">
          <span className="hp-sv__avatar hp-sv__avatar--alt">RL</span>
          <span className="hp-sv__team-text">
            <span className="hp-sv__name">Riley Lee</span>
            <span className="hp-sv__meta">Community lead · riley@ribosome.example</span>
          </span>
        </div>
      </div>
    </Frame>
  )
}

export const STAGE_VISUALS = {
  draft: TeamPage,
  review: Review,
  sent: Questions,
  matched: Match,
} as const
