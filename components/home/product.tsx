import type { ReactNode } from 'react'

import { MarkGlyph } from '@/components/app/wordmark'

import { Chevron, I } from './icons'

/*
 * The product, drawn in markup: the hero window and its satellites, and the panel under each chapter of
 * "How it works". Every screen is a real FTC Pitfund screen (pitches, the composer, review, the company
 * inbox, a match), simplified. Teams and companies in them are samples, not customers. Each window is
 * one image to assistive technology (role="img" + a label); the markup inside is hidden from it.
 * Styles: `.pm-*` in app/(public)/home.css.
 */

type Tone = 'draft' | 'review' | 'sent' | 'matched' | 'returned'
const TONE_LABEL: Record<Tone, string> = { draft: 'Draft', review: 'In review', sent: 'Sent', matched: 'Interested', returned: 'Needs changes' }

function Dots() {
  return (
    <span className="pm-lights" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

/** A window: the frosted frame with traffic lights, and the app inside it. */
function Win({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`pm-win ${className ?? ''}`} role="img" aria-label={label}>
      <div className="pm-win__bar">
        <Dots />
      </div>
      <div className="pm-win__body" aria-hidden="true">
        {children}
      </div>
    </div>
  )
}

function Chip({ tone, children }: { tone: Tone; children?: ReactNode }) {
  return <span className={`pm-chip pm-chip--${tone}`}>{children ?? TONE_LABEL[tone]}</span>
}

function Logo({ text, hue }: { text: string; hue: number }) {
  return (
    <span className="pm-logo" style={{ ['--h' as string]: hue }}>
      {text}
    </span>
  )
}

function Avatar({ text, hue }: { text: string; hue: number }) {
  return (
    <span className="pm-av" style={{ ['--h' as string]: hue }}>
      {text}
    </span>
  )
}

/* ─── The hero ─────────────────────────────────────────────────────────────────────────────── */

const SIDEBAR_PITCHES: Array<[string, Tone]> = [
  ['Northwind Aero', 'matched'],
  ['Lumen Circuits', 'draft'],
  ['Harborline Labs', 'review'],
  ['Copperleaf Tools', 'sent'],
  ['Ridgeway Plastics', 'returned'],
]

function Sidebar() {
  return (
    <div className="pm-side">
      <div className="pm-side__ws">
        <Logo text="EX" hue={220} />
        <b>Exodius</b>
        <Chevron />
      </div>
      <div className="pm-side__search">
        <I.search />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </div>
      <ul className="pm-side__nav">
        <li className="is-on">
          <I.send />
          Pitches
        </li>
        <li>
          <I.users />
          Sponsors
        </li>
        <li>
          <I.file />
          Team page
        </li>
        <li>
          <I.mail />
          Inbox <em>2</em>
        </li>
      </ul>
      <p className="pm-side__group">2026–27 season</p>
      <ul className="pm-side__list">
        {SIDEBAR_PITCHES.map(([name, tone]) => (
          <li key={name} className={name === 'Lumen Circuits' ? 'is-on' : ''}>
            <i className={`pm-dot pm-dot--${tone}`} />
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}

const ANSWERS: Array<[string, string]> = [
  ['What would our support pay for this season?', 'Aluminium and machining for a new drivetrain, plus registration for two qualifiers.'],
  ['How does your team reach students outside the team?', 'Four free summer workshops for FIRST LEGO League teams at our public library.'],
  ['How would you recognize us?', 'Your logo on the robot and our pit banner, and a thank-you on our team page.'],
]

/** The hero window: the composer for a pitch to one company, with the team's pitches in the sidebar. */
export function HeroApp() {
  return (
    <Win label="FTC Pitfund: a team writing a pitch to a company, answering that company’s own questions" className="pm-win--hero">
      <div className="pm-app">
        <Sidebar />
        <div className="pm-main">
          <div className="pm-top">
            <span className="pm-crumb">
              Pitches <I.right /> <b>Lumen Circuits</b>
            </span>
            <span className="pm-saved">
              <I.check />
              Saved
            </span>
          </div>
          <div className="pm-doc">
            <div className="pm-doc__head">
              <Logo text="LC" hue={28} />
              <div>
                <p className="pm-doc__title">Pitch to Lumen Circuits</p>
                <p className="pm-doc__meta">3 questions from Lumen Circuits · answered 3 of 3</p>
              </div>
              <Chip tone="draft" />
            </div>
            {ANSWERS.map(([q, a], i) => (
              <div key={q} className={`pm-qa ${i === 2 ? 'is-focus' : ''}`}>
                <p className="pm-qa__q">
                  <span className="pm-qa__n">{i + 1}</span>
                  {q}
                </p>
                <p className="pm-qa__a">
                  {a}
                  {i === 2 ? <span className="pm-caret" /> : null}
                </p>
              </div>
            ))}
            <div className="pm-doc__foot">
              <span className="pm-deck">
                <I.file />
                Exodius-sponsorship-deck.pdf · 5 pages
              </span>
              <span className="pm-btn pm-btn--ink">Submit for review</span>
            </div>
          </div>
        </div>
      </div>
    </Win>
  )
}

/** Top left: the bell, which is a to-do list of what needs the team next. */
export function HeroInbox() {
  const rows: Array<[string, string, string, number]> = [
    ['NA', 'Northwind Aero said Interested', 'Their contacts are on the pitch', 150],
    ['R', 'A reviewer returned a pitch', 'Ridgeway Plastics · 1 note', 210],
    ['HL', 'Harborline Labs is in review', 'Waiting for a reviewer', 190],
  ]
  return (
    <Win label="The team’s inbox: a company said Interested, and a reviewer returned a pitch with a note" className="pm-sat pm-sat--inbox">
      <div className="pm-inbox">
        <p className="pm-inbox__head">Inbox</p>
        {rows.map(([a, t, s, h]) => (
          <div key={t} className="pm-inbox__row">
            <Avatar text={a} hue={h} />
            <span>
              <b>{t}</b>
              <small>{s}</small>
            </span>
          </div>
        ))}
      </div>
    </Win>
  )
}

/** Bottom left: the reviewers' queue, where every pitch waits for a person before a company sees it. */
export function HeroQueue() {
  const rows: Array<[string, string, string, number, boolean]> = [
    ['EX', 'Exodius → Harborline Labs', 'Team 31579 · 3 of 3 answered', 220, true],
    ['TD', 'Tidal Drive → Copperleaf Tools', 'Team 22105 · 4 of 4 answered', 190, false],
    ['GM', 'Gearmind → Northwind Aero', 'Team 16091 · 3 of 3 answered', 300, false],
  ]
  return (
    <Win label="The review queue: every pitch waits here for a person before any company sees it" className="pm-sat pm-sat--queue">
      <div className="pm-queue">
        <p className="pm-queue__head">
          <b>Review</b>
          <span>3 pitches waiting</span>
        </p>
        {rows.map(([a, t, s, h, on]) => (
          <div key={t} className={`pm-queue__row ${on ? 'is-on' : ''}`}>
            <Logo text={a} hue={h} />
            <span>
              <b>{t}</b>
              <small>{s}</small>
            </span>
          </div>
        ))}
        <p className="pm-queue__foot">
          <span className="pm-btn pm-btn--line">Return with a note</span>
          <span className="pm-btn pm-btn--ink">Send to company</span>
        </p>
      </div>
    </Win>
  )
}

/** Right: the public team page, the one link a team sends anywhere. */
export function HeroTeamPage() {
  return (
    <Win label="A public team page: logo, team number, a one-line summary and a five-page deck" className="pm-sat pm-sat--team">
      <div className="pm-tp">
        <p className="pm-tp__url">pitfund.org/t/31579</p>
        <div className="pm-tp__id">
          <Logo text="EX" hue={220} />
          <span>
            <b>
              Exodius <I.check className="pm-ok" />
            </b>
            <small>FTC Team 31579</small>
          </span>
        </div>
        <Slide />
        <div className="pm-tp__thumbs">
          <i className="is-on" />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </Win>
  )
}

/** Page one of a sponsorship deck, drawn: a title, a robot on a field and two figures. */
function Slide({ big }: { big?: boolean }) {
  return (
    <div className={`pm-slide ${big ? 'pm-slide--big' : ''}`}>
      <p className="pm-slide__kicker">2026–27 sponsorship</p>
      <p className="pm-slide__title">Exodius builds robots and runs free workshops.</p>
      <svg className="pm-slide__art" viewBox="0 0 160 70">
        <path d="M4 66 L40 40 H120 L156 66 Z" className="pm-slide__field" />
        <path d="M22 53 H138 M80 40 V66" className="pm-slide__grid" />
        <rect x="62" y="24" width="36" height="22" rx="3" className="pm-slide__bot" />
        <path d="M68 24 V12 H74 M92 24 V8 M86 8 H98" className="pm-slide__bot" />
        <circle cx="68" cy="48" r="5" className="pm-slide__wheel" />
        <circle cx="92" cy="48" r="5" className="pm-slide__wheel" />
      </svg>
      <p className="pm-slide__figs">
        <span>
          <b>3rd</b> season
        </span>
        <span>
          <b>4</b> workshops
        </span>
      </p>
    </div>
  )
}

/* ─── Chapter panels (900 × 508, centered on a grey field) ──────────────────────────────────── */

export function PanelTeamPage() {
  return (
    <Win label="A team’s public page: name, team number, verified badge, summary and a five-page deck viewer" className="pm-panel">
      <div className="pm-pub">
        <div className="pm-pub__bar">
          <span className="pm-pub__brand">pitfund</span>
          <span className="pm-pub__url">pitfund.org/t/31579</span>
          <span className="pm-btn pm-btn--line">Copy link</span>
        </div>
        <div className="pm-pub__grid">
          <div className="pm-pub__info">
            <Logo text="EX" hue={220} />
            <p className="pm-pub__name">
              Exodius <I.check className="pm-ok" />
            </p>
            <p className="pm-pub__num">FTC Team 31579 · verified against FIRST</p>
            <p className="pm-pub__sum">A third-year community team building a reliable robot and running free workshops for younger students.</p>
            <dl className="pm-pub__facts">
              <div>
                <dt>Season</dt>
                <dd>2026–27</dd>
              </div>
              <div>
                <dt>Deck</dt>
                <dd>5 pages</dd>
              </div>
              <div>
                <dt>Members</dt>
                <dd>3 adults</dd>
              </div>
            </dl>
          </div>
          <div className="pm-pub__deck">
            <Slide big />
            <div className="pm-pub__pager">
              <span>Page 1 of 5</span>
              <span className="pm-pub__thumbs">
                <i className="is-on" />
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Win>
  )
}

const QUESTIONS: Array<[string, string, boolean]> = [
  ['What would our support pay for this season?', 'Aluminium and machining for a new drivetrain, plus registration for two qualifiers.', true],
  ['How does your team reach students outside the team?', 'Four free summer workshops for FIRST LEGO League teams at our public library.', true],
  ['Who on your team would we talk to?', 'Our coach and our outreach lead, both reachable by email', false],
  ['How would you recognize us?', '', false],
]

export function PanelComposer() {
  return (
    <Win label="The pitch composer: a company’s own four questions, two answered, one being typed, saved automatically" className="pm-panel">
      <div className="pm-comp">
        <div className="pm-comp__side">
          <Logo text="LC" hue={28} />
          <p className="pm-comp__co">Lumen Circuits</p>
          <p className="pm-comp__sub">Approved company · Electronics</p>
          <p className="pm-comp__label">Their questions</p>
          <ol className="pm-comp__steps">
            {QUESTIONS.map(([q, , done], i) => (
              <li key={q} className={done ? 'is-done' : i === 2 ? 'is-on' : ''}>
                <span>{done ? <I.check /> : i + 1}</span>
                {q}
              </li>
            ))}
          </ol>
          <p className="pm-comp__rule">One pitch per company, per season</p>
        </div>
        <div className="pm-comp__main">
          <div className="pm-top">
            <span className="pm-crumb">
              Pitches <I.right /> <b>Lumen Circuits</b>
            </span>
            <span className="pm-saved pm-saved--busy">Saving…</span>
          </div>
          {QUESTIONS.slice(0, 3).map(([q, a], i) => (
            <div key={q} className={`pm-field ${i === 2 ? 'is-focus' : ''}`}>
              <p className="pm-field__label">
                {i + 1}. {q}
              </p>
              <p className="pm-field__box">
                {a}
                {i === 2 ? <span className="pm-caret" /> : null}
              </p>
            </div>
          ))}
          <div className="pm-comp__foot">
            <span>2 of 4 answered</span>
            <span className="pm-btn pm-btn--ink pm-btn--off">Submit for review</span>
          </div>
        </div>
      </div>
    </Win>
  )
}

export function PanelReview() {
  return (
    <Win label="A reviewer reading a pitch, with a note on what to fix before returning it to the team" className="pm-panel">
      <div className="pm-rev">
        <div className="pm-rev__doc">
          <div className="pm-top">
            <span className="pm-crumb">
              Review <I.right /> <b>Ridgeway Plastics ← Team 16091</b>
            </span>
            <Chip tone="review" />
          </div>
          <div className="pm-rev__body">
            <p className="pm-field__label">1. What would our support pay for?</p>
            <p className="pm-rev__a is-flag">Parts for our robot.</p>
            <p className="pm-field__label">2. How do you reach students outside the team?</p>
            <p className="pm-rev__a">We run two open build nights a month at our school, open to any middle schooler.</p>
            <p className="pm-field__label">3. How would you recognize us?</p>
            <p className="pm-rev__a">Logo on the robot, the pit and our team page.</p>
          </div>
        </div>
        <div className="pm-rev__panel">
          <p className="pm-rev__h">Your decision</p>
          <div className="pm-rev__choice">
            <span>Send to Ridgeway Plastics</span>
            <span className="is-on">Return with a note</span>
          </div>
          <p className="pm-field__label">Note to the team</p>
          <p className="pm-field__box pm-field__box--tall">
            Answer 1 is too short. Say which parts, roughly what they cost, and what they let your robot do.
            <span className="pm-caret" />
          </p>
          <span className="pm-btn pm-btn--ink pm-btn--wide">Return to team</span>
        </div>
      </div>
    </Win>
  )
}

const INBOX: Array<[string, string, string, string, number]> = [
  ['EX', 'Exodius', '31579', 'Drivetrain parts and four free library workshops', 220],
  ['TD', 'Tidal Drive', '22105', 'A rookie team’s first full season of parts', 160],
  ['GM', 'Gearmind', '16091', 'Travel to the state championship', 300],
  ['IO', 'Iron Owls', '19438', 'Field elements for weekly scrimmages', 30],
]

export function PanelInbox() {
  return (
    <Win label="A company’s inbox of reviewed pitches, one open with Interested and Not a fit buttons" className="pm-panel">
      <div className="pm-co">
        <div className="pm-top">
          <span className="pm-crumb">
            <Logo text="NA" hue={150} />
            <b>Northwind Aero</b> · Inbox
          </span>
          <span className="pm-tabs">
            <span className="is-on">To answer · 4</span>
            <span>Interested</span>
            <span>Not a fit</span>
          </span>
        </div>
        <div className="pm-table">
          <div className="pm-table__head">
            <span>Team</span>
            <span>Number</span>
            <span>What they’re asking for</span>
            <span>Reviewed</span>
          </div>
          {INBOX.map(([a, n, num, ask, h], i) => (
            <div key={n} className={`pm-table__row ${i === 0 ? 'is-on' : ''}`}>
              <span className="pm-table__team">
                <Logo text={a} hue={h} />
                {n}
              </span>
              <span className="pm-tabular">{num}</span>
              <span className="pm-table__ask">{ask}</span>
              <span>
                <I.check className="pm-ok" />
              </span>
            </div>
          ))}
        </div>
        <div className="pm-co__answer">
          <p>
            <b>Exodius · Team 31579</b> answered your 3 questions and attached a 5-page deck.
          </p>
          <span className="pm-btn pm-btn--line">Not a fit</span>
          <span className="pm-btn pm-btn--blue">Interested</span>
        </div>
      </div>
    </Win>
  )
}

export function PanelMatched() {
  return (
    <Win label="A matched pitch: the company said Interested, so both sides now see each other’s contact details" className="pm-panel">
      <div className="pm-match">
        <div className="pm-top">
          <span className="pm-crumb">
            Pitches <I.right /> <b>Northwind Aero</b>
          </span>
          <Chip tone="matched" />
        </div>
        <ol className="pm-match__steps">
          <li className="is-done">Submitted</li>
          <li className="is-done">Reviewed</li>
          <li className="is-done">Sent</li>
          <li className="is-live">Interested</li>
        </ol>
        <p className="pm-match__lead">Northwind Aero is interested. You can now see each other’s contact details.</p>
        <div className="pm-match__cards">
          <div className="pm-contact">
            <p className="pm-contact__label">Your team</p>
            <div className="pm-contact__who">
              <Avatar text="JP" hue={220} />
              <span>
                <b>Jordan Park</b>
                <small>Coach · Exodius</small>
              </span>
            </div>
            <p className="pm-contact__line">
              <I.mail /> coach@exodius.example
            </p>
          </div>
          <div className="pm-contact pm-contact--them">
            <p className="pm-contact__label">Northwind Aero</p>
            <div className="pm-contact__who">
              <Avatar text="SR" hue={150} />
              <span>
                <b>Sam Rivera</b>
                <small>Community programs</small>
              </span>
            </div>
            <p className="pm-contact__line">
              <I.mail /> community@northwind.example
            </p>
          </div>
        </div>
        <p className="pm-match__foot">Arrange the sponsorship directly. FTC Pitfund never handles money.</p>
      </div>
    </Win>
  )
}

/* ─── Small visuals for the half-width cells under a chapter ────────────────────────────────── */

export function CellVerify() {
  return (
    <div className="pm-cell" role="img" aria-label="Team setup: searching FIRST’s list for 31579 finds Exodius, and a Dashboard screenshot is attached">
      <div className="pm-card" aria-hidden="true">
        <p className="pm-field__label">Find your team</p>
        <p className="pm-field__box pm-field__box--one">
          31579
          <span className="pm-caret" />
        </p>
        <div className="pm-found">
          <Logo text="EX" hue={220} />
          <span>
            <b>Exodius</b>
            <small>31579 · on FIRST’s list</small>
          </span>
          <I.check className="pm-ok" />
        </div>
        <div className="pm-file">
          <I.file />
          <span>
            <b>dashboard-screenshot.png</b>
            <small>Private · only reviewers see it</small>
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * The team page link pasted into an email to a sponsor, unfurled into the share card FTC Pitfund
 * actually serves for it (lib/server/og.tsx renderTeamCard): dark, the accent edge, the mark, the
 * number, the name, the summary and the deck's first page.
 */
export function CellShare() {
  return (
    <div className="pm-cell" role="img" aria-label="The team page link sent to a sponsor, unfurled into the team’s share card: number, name, summary and the deck’s first page">
      <div className="pm-mail" aria-hidden="true">
        <p className="pm-mail__body">
          Hi Sam, here’s our team page with this season’s deck: <u>pitfund.org/t/31579</u>
        </p>
        <OgCard />
      </div>
    </div>
  )
}

function OgCard() {
  return (
    <div className="pm-ogc">
      <div className="pm-ogc__text">
        <span className="pm-ogc__brand">
          <MarkGlyph />
          FTC Pitfund
        </span>
        <span className="pm-ogc__sub">Team 31579</span>
        <b>Exodius</b>
        <small>A third-year community team building a reliable robot and running free workshops.</small>
      </div>
      <div className="pm-ogc__page">
        <i className="pm-ogc__kick" />
        <i />
        <i className="pm-ogc__short" />
        <svg viewBox="0 0 160 70">
          <path d="M4 66 L40 40 H120 L156 66 Z" className="pm-slide__field" />
          <rect x="62" y="24" width="36" height="22" rx="3" className="pm-slide__bot" />
          <circle cx="68" cy="48" r="5" className="pm-slide__wheel" />
          <circle cx="92" cy="48" r="5" className="pm-slide__wheel" />
        </svg>
      </div>
    </div>
  )
}

/** The team's Pitches page: this season's pitches and where each one stands. */
export function CellPitches() {
  const rows: Array<[string, string, Tone, number]> = [
    ['NA', 'Northwind Aero', 'matched', 150],
    ['HL', 'Harborline Labs', 'review', 200],
    ['CT', 'Copperleaf Tools', 'sent', 90],
    ['LC', 'Lumen Circuits', 'draft', 28],
  ]
  return (
    <div className="pm-cell" role="img" aria-label="The team’s pitches this season: one matched, one in review, one sent, one draft">
      <div className="pm-card pm-card--list pm-card--wide" aria-hidden="true">
        <p className="pm-field__label">Exodius · pitches · 2026–27</p>
        {rows.map(([a, n, t, h]) => (
          <div key={n} className="pm-list__row">
            <Logo text={a} hue={h} />
            <b>{n}</b>
            <Chip tone={t} />
          </div>
        ))}
        <p className="pm-list__add">
          <I.plus /> Pitch another approved company
        </p>
      </div>
    </div>
  )
}

/** One pitch as a company sees it in its inbox: reviewed, and two buttons. Drawn for the dark section. */
export function CellIncoming() {
  return (
    <div className="pm-cell" role="img" aria-label="A reviewed pitch in a company’s inbox, with Not a fit and Interested buttons">
      <div className="pm-in" aria-hidden="true">
        <p className="pm-in__top">
          <span>Northwind Aero · Inbox</span>
          <span className="pm-in__count">To answer · 1</span>
        </p>
        <div className="pm-in__card">
          <p className="pm-in__who">
            <Logo text="EX" hue={220} />
            <span>
              <b>Exodius</b>
              <small>FTC Team 31579 · reviewed by FTC Pitfund</small>
            </span>
          </p>
          <p className="pm-in__q">What would our support pay for this season?</p>
          <p className="pm-in__a">Aluminium and machining for a new drivetrain, plus registration for two qualifiers.</p>
          <p className="pm-in__meta">3 of 3 questions answered · 5-page deck</p>
          <p className="pm-in__btns">
            <span className="pm-btn pm-btn--line">Not a fit</span>
            <span className="pm-btn pm-btn--blue">Interested</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export function CellNote() {
  return (
    <div className="pm-cell" role="img" aria-label="A returned pitch: the reviewer’s note says what to fix, with a button to edit the pitch">
      <div className="pm-card pm-card--note" aria-hidden="true">
        <p className="pm-note__head">
          <Chip tone="returned" />
          <span>Ridgeway Plastics</span>
        </p>
        <p className="pm-note__body">“Answer 1 is too short. Say which parts, roughly what they cost, and what they let your robot do.”</p>
        <p className="pm-note__by">— FTC Pitfund reviewer</p>
        <span className="pm-btn pm-btn--ink">Edit and resubmit</span>
      </div>
    </div>
  )
}

export function CellCompanies() {
  const rows: Array<[string, string, string, boolean, number]> = [
    ['NA', 'Northwind Aero', 'Approved', true, 150],
    ['LC', 'Lumen Circuits', 'Approved', true, 28],
    ['CT', 'Copperleaf Tools', 'Approved', true, 90],
    ['QX', 'Quarry & Co', 'Pending · hidden from teams', false, 0],
  ]
  return (
    <div className="pm-cell" role="img" aria-label="Sponsors list: three approved companies, and one pending company that teams cannot see">
      <div className="pm-card pm-card--list" aria-hidden="true">
        {rows.map(([a, n, s, ok, h]) => (
          <div key={n} className={`pm-list__row ${ok ? '' : 'is-off'}`}>
            <Logo text={a} hue={h} />
            <b>{n}</b>
            <small>{s}</small>
            {ok ? <I.check className="pm-ok" /> : <I.lock className="pm-lock" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CellSeason() {
  return (
    <div className="pm-cell" role="img" aria-label="This season’s slots: one pitch per company, with one withdrawn pitch freeing its slot">
      <div className="pm-card pm-card--list" aria-hidden="true">
        <p className="pm-field__label">2026–27 · Sept 1 – Aug 31</p>
        {(
          [
            ['Northwind Aero', 'Interested', 'matched'],
            ['Harborline Labs', 'In review', 'review'],
            ['Copperleaf Tools', 'Withdrawn · slot free', 'draft'],
          ] as Array<[string, string, Tone]>
        ).map(([n, s, t]) => (
          <div key={n} className="pm-list__row">
            <i className={`pm-dot pm-dot--${t}`} />
            <b>{n}</b>
            <small>{s}</small>
            <span className="pm-tabular pm-slot">1 / 1</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CellMembers() {
  const rows: Array<[string, string, string, number]> = [
    ['JP', 'Jordan Park', 'Owner', 220],
    ['AL', 'Alex Lee', 'Editor', 300],
    ['MC', 'Morgan Cruz', 'Editor', 30],
  ]
  return (
    <div className="pm-cell" role="img" aria-label="Team members: one owner and two editors on a shared team account">
      <div className="pm-card pm-card--list" aria-hidden="true">
        <p className="pm-field__label">Exodius · 3 members</p>
        {rows.map(([a, n, r, h]) => (
          <div key={n} className="pm-list__row">
            <Avatar text={a} hue={h} />
            <b>{n}</b>
            <small>{r}</small>
          </div>
        ))}
        <span className="pm-btn pm-btn--line pm-btn--wide">Invite someone</span>
      </div>
    </div>
  )
}

/** A company writing its own questions during setup: what teams will answer when they pitch it. */
export function CellQuestions() {
  const qs = ['What would our support pay for this season?', 'How does your team reach students outside the team?', 'How would you recognize us?']
  return (
    <div className="pm-cell" role="img" aria-label="A company writing the questions every team will answer when it pitches them: three written, room for ten">
      <div className="pm-card pm-card--list" aria-hidden="true">
        <p className="pm-field__label">Northwind Aero · your questions</p>
        {qs.map((q, i) => (
          <div key={q} className="pm-list__row pm-list__row--q">
            <span className="pm-qa__n">{i + 1}</span>
            <b>{q}</b>
          </div>
        ))}
        <p className="pm-list__add">
          <I.plus /> Add a question · 3 of 10
        </p>
      </div>
    </div>
  )
}
