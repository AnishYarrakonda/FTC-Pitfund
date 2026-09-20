/*
 * The product illustrations inside the bento cards: HTML/CSS mock-ups of the real screens (the reference
 * draws its card graphics in DOM the same way), animated with CSS keyframes, plus two canvases that
 * effects/ draws (the dotted globe and the line wave).
 */

const TEAMS = [
  { team: 'Exodius', number: '31579', city: 'Austin, TX', color: '#1e40af', company: 'BioBuzz Foundation', slug: 'biobuzz', ask: 'Help with our $2,400 field kit', q: 'Tell us how your team started.', a: 'Four parents started Exodius in a garage in 2021. Two coaches and a mentor run it today.' },
  { team: 'Spore Sprinters', number: '8402', city: 'Columbus, OH', color: '#047857', company: 'Northwind Aero', slug: 'northwind', ask: 'Travel to the state championship', q: 'What does a season cost your team?', a: 'About $6,000: parts, registration, and two competition trips.' },
  { team: 'Nucleus Navigators', number: '15234', city: 'Tacoma, WA', color: '#00805f', company: 'Lumen Circuits', slug: 'lumen', ask: 'Sponsor our summer camp', q: 'What outreach has your team done?', a: 'Free build nights for 120 middle schoolers and a summer camp.' },
]

export function PitchGraphic() {
  return (
    <div className="hp-g hp-g-pitch" aria-hidden="true">
      <div className="hp-g-pitch__swoosh" />
      <div className="hp-g-phone">
        <div className="hp-g-phone__screen">
          {TEAMS.map((t, i) => (
            <div key={t.number} className="hp-g-cycle" style={{ animationDelay: `${i * 4}s` }}>
              <div className="hp-g-phone__logo" style={{ background: t.color, color: '#fff', fontWeight: 600, fontSize: 16 }}>
                {t.team[0]}
              </div>
              <p className="hp-g-phone__small">Pitch to {t.company.split(' ')[0]}</p>
              <p className="hp-g-phone__big">{t.team}</p>
              <p className="hp-g-phone__small">Team {t.number} · {t.city}</p>
              <dl className="hp-g-rows">
                <div>
                  <dt>Deck</dt>
                  <dd>4 pages</dd>
                </div>
                <div>
                  <dt>Questions</dt>
                  <dd>4 of 4</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>In review</dd>
                </div>
                <div className="hp-g-rows__total">
                  <dt>Season</dt>
                  <dd>2026–27</dd>
                </div>
              </dl>
              <span className="hp-g-btn" style={{ background: `${t.color}22`, color: t.color }}>
                View pitch
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="hp-g-browser">
        <div className="hp-g-browser__bar">
          <i />
          <i />
          <i />
          <span className="hp-g-browser__url">
            {TEAMS.map((t, i) => (
              <span key={t.slug} className="hp-g-cycle" style={{ animationDelay: `${i * 4}s` }}>
                ftcpitfund.com/pitch/{t.slug}
              </span>
            ))}
          </span>
        </div>
        <div className="hp-g-browser__body">
          {TEAMS.map((t, i) => (
            <div key={t.slug} className="hp-g-cycle hp-g-composer" style={{ animationDelay: `${i * 4}s` }}>
              <p className="hp-g-composer__brand">{t.company.toUpperCase()}</p>
              <div className="hp-g-composer__cols">
                <div>
                  <p className="hp-g-label">1. {t.q}</p>
                  <div className="hp-g-field">{t.a}</div>
                  <p className="hp-g-label">2. What would you like from us?</p>
                  <div className="hp-g-field">{t.ask}</div>
                  <div className="hp-g-or">
                    <span />
                    saved
                    <span />
                  </div>
                  <p className="hp-g-label">Your deck</p>
                  <div className="hp-g-choice">
                    <span className="hp-g-radio hp-g-radio--on" />
                    {t.team}-deck.pdf · 4 pages
                  </div>
                  <div className="hp-g-choice">
                    <span className="hp-g-radio" />
                    Upload a new deck
                  </div>
                  <span className="hp-g-btn hp-g-btn--full" style={{ background: `${t.color}26`, color: t.color }}>
                    Submit for review
                  </span>
                </div>
                <div className="hp-g-summary">
                  <p className="hp-g-label">What they will see</p>
                  <div className="hp-g-summary__team">
                    <span style={{ background: t.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>{t.team[0]}</span>
                    <div>
                      <b>{t.team}</b>
                      <small>
                        Team {t.number} · {t.city}
                      </small>
                    </div>
                  </div>
                  <dl className="hp-g-rows">
                    <div>
                      <dt>Ask</dt>
                      <dd>{t.ask.split(' ').slice(0, 3).join(' ')}</dd>
                    </div>
                    <div>
                      <dt>Deck</dt>
                      <dd>4 pages</dd>
                    </div>
                    <div className="hp-g-rows__total">
                      <dt>Reviewed</dt>
                      <dd>Before sending</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const BARS = [18, 26, 22, 34, 30, 44, 38, 52, 47, 60, 41, 36, 55, 66, 58, 72, 49, 63, 80, 70, 57, 76, 92, 64, 71, 85, 60, 78]

export function QuestionsGraphic() {
  return (
    <div className="hp-g hp-g-questions" aria-hidden="true">
      <div className="hp-g-questions__glow" />
      <div className="hp-g-card hp-g-plan">
        <div className="hp-g-plan__head">
          <span className="hp-g-plan__logo">B</span>
          <div>
            <b>BioBuzz Foundation</b>
            <small>Your questions</small>
          </div>
        </div>
        <p className="hp-g-plan__k">Questions</p>
        <p className="hp-g-plan__v">4 of 10 written</p>
        <p className="hp-g-plan__k hp-g-plan__k--icon">◔ Answers required</p>
        <div className="hp-g-meter">
          <span />
        </div>
      </div>
      <div className="hp-g-card hp-g-chart">
        <p className="hp-g-plan__k">Pitches received this season</p>
        <p className="hp-g-chart__v hp-tabular">24 reviewed</p>
        <div className="hp-g-bars">
          {BARS.map((h, i) => (
            <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

const QUEUE = [
  { name: 'Exodius', n: '31579', c: '#1e40af' },
  { name: 'Spore Sprinters', n: '8402', c: '#047857' },
  { name: 'Nucleus Navigators', n: '15234', c: '#00805f' },
  { name: 'Petri Prowlers', n: '22150', c: '#a16207' },
  { name: 'RNA Racers', n: '19077', c: '#0086a8' },
]

export function ReviewGraphic() {
  return (
    <div className="hp-g hp-g-review" aria-hidden="true">
      <div className="hp-g-card hp-g-queue">
        <p className="hp-g-queue__head">
          Review queue <span>5 waiting</span>
        </p>
        {QUEUE.map((q, i) => (
          <div key={q.n} className="hp-g-queue__row">
            <span className="hp-g-queue__dot" style={{ background: q.c }}>
              {q.name[0]}
            </span>
            <span className="hp-g-queue__name">
              {q.name}
              <small>Team {q.n}</small>
            </span>
            <span className="hp-g-status" style={{ animationDelay: `${i * 1.2}s` }}>
              <i>Waiting</i>
              <i>Reading</i>
              <i>Sent on</i>
            </span>
          </div>
        ))}
      </div>
      <div className="hp-g-card hp-g-note">
        <p className="hp-g-label">Note to Petri Prowlers</p>
        <p>Your deck is great. Please answer question 3 with a rough budget, then resubmit.</p>
        <span className="hp-g-btn" style={{ background: '#e8e9ff', color: '#1e40af' }}>
          Send back with note
        </span>
      </div>
    </div>
  )
}

export function VerifiedGraphic() {
  return (
    <div className="hp-g hp-g-verified" aria-hidden="true">
      <div className="hp-g-idcard" data-hp-tilt>
        <div className="hp-g-idcard__art" />
        <div className="hp-g-idcard__shine" />
        <span className="hp-g-idcard__mark">
          <svg viewBox="0 0 32 32">
            <rect x="9.5" y="7.5" width="4" height="17" rx="1.6" fill="#fff" />
            <path d="M11.5 7.5H18a5.3 5.3 0 0 1 0 10.6h-6.5" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
          </svg>
        </span>
        <div className="hp-g-idcard__foot">
          <span>FTC 31579</span>
          <b>VERIFIED</b>
        </div>
      </div>
    </div>
  )
}

export function PublicGraphic() {
  return (
    <div className="hp-g hp-g-public" aria-hidden="true">
      <canvas className="hp-g-globe" data-hp-globe />
    </div>
  )
}

const INBOX = [
  { team: 'Exodius', n: '31579', where: 'Austin, TX', q: '4 of 4', status: 'Interested', tone: 'ok', c: '#1e40af' },
  { team: 'Spore Sprinters', n: '8402', where: 'Columbus, OH', q: '4 of 4', status: 'New', tone: 'new', c: '#047857' },
  { team: 'Nucleus Navigators', n: '15234', where: 'Tacoma, WA', q: '4 of 4', status: 'New', tone: 'new', c: '#00805f' },
  { team: 'Petri Prowlers', n: '22150', where: 'Denver, CO', q: '4 of 4', status: 'Not a fit', tone: 'no', c: '#a16207' },
  { team: 'RNA Racers', n: '19077', where: 'Miami, FL', q: '4 of 4', status: 'Interested', tone: 'ok', c: '#0086a8' },
  { team: 'Cell Cyclers', n: '11115', where: 'Boise, ID', q: '4 of 4', status: 'New', tone: 'new', c: '#0f766e' },
  { team: 'Helix Hoppers', n: '9001', where: 'Omaha, NE', q: '4 of 4', status: 'New', tone: 'new', c: '#16a34a' },
]

export function MatchGraphic() {
  return (
    <div className="hp-g hp-g-match" aria-hidden="true">
      <canvas className="hp-g-lines" data-hp-lines="warm" />
      <div className="hp-g-card hp-g-receipt">
        <div className="hp-g-receipt__head">
          <span className="hp-g-receipt__logo">B</span>
          <b>Match made</b>
          <small>BioBuzz Foundation</small>
        </div>
        <dl className="hp-g-rows">
          <div>
            <dt>Team</dt>
            <dd>Exodius · 31579</dd>
          </div>
          <div>
            <dt>Answer</dt>
            <dd>Interested</dd>
          </div>
          <div>
            <dt>Coach</dt>
            <dd>Jordan Park</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>coach@exodiusftc.com</dd>
          </div>
          <div className="hp-g-rows__total">
            <dt>Shared with</dt>
            <dd>You two only</dd>
          </div>
        </dl>
      </div>
      <div className="hp-g-card hp-g-inbox">
        <div className="hp-g-inbox__bar">
          <span>Inbox</span>
          <span className="hp-g-inbox__search">Search teams</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Location</th>
              <th>Questions</th>
              <th>Answer</th>
            </tr>
          </thead>
          <tbody>
            {INBOX.map((r) => (
              <tr key={r.n}>
                <td>
                  <span className="hp-g-inbox__dot" style={{ background: r.c }}>
                    {r.team[0]}
                  </span>
                  {r.team}
                </td>
                <td>{r.where}</td>
                <td>{r.q}</td>
                <td>
                  <span className={`hp-g-pill hp-g-pill--${r.tone}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
