/*
 * "Find where to start": deciding which door a typed sentence belongs to.
 *
 * This used to be a list of regexes tried in order, first match wins, and it broke in the three ways
 * a real visitor hits immediately. "How much does a company pay?" matched the company rule because
 * company happened to be written first, not because the sentence was about companies. One wrong
 * letter ("sponser", "recieve") matched nothing at all and dropped you on the generic fallback. And
 * a sentence that mentions both sides was settled by the order the rules were written in.
 *
 * So every intent is now *scored* against the whole sentence and the best one wins, with the margin
 * to the runner-up deciding whether we answer confidently, offer two doors, or admit we don't know.
 *
 * No model, no network, no key, nothing to download: a weighted bag of words per intent, matched
 * with prefix and edit-distance fallbacks so near-misses and typos still land, plus phrases for the
 * things one word can't settle ("how much", "sign in", "we need a sponsor" vs "we sponsor teams").
 * 4.6 KB gzipped in the idle-loaded effects chunk, so it never touches the first-load budget, and
 * well under a millisecond per keystroke. tests/unit/find-match.test.ts holds it to a corpus of the
 * sentences people actually type here — add to that corpus before touching the weights.
 */

type FindIntent = {
  id: string
  /** The sentence the box answers with when this intent wins. */
  text: string
  cta: string
  href: string
  /** How it is offered when it is only the runner-up. */
  also: string
}

type Authored = FindIntent & {
  /** Space-separated words, `^weight` to lean on one (default 1). Stemmed at load, like the query. */
  terms: string
  /** Word sequences, weighted the same way. Also stemmed, with `a`/`an`/`the` dropped from both sides. */
  phrases?: string[]
}

/*
 * Every answer here has to be true of the product, not of the marketing: the box is the one place on
 * the page where someone asks a direct question, so a wrong answer costs more than a vague one.
 */
const AUTHORED: Authored[] = [
  {
    id: 'company',
    text: 'Sounds like you are on the company side. Set up your company, write the questions you want teams to answer, and a reviewer approves you before any pitch reaches you.',
    cta: 'Set up your company',
    href: '/login?intent=company',
    also: 'I represent a company',
    terms:
      'company^1.5 business^1.4 corporate^1.3 corporation^1.3 employer^1.3 firm^1.2 organisation organization employee^0.9 startup^1.1 ' +
      'philanthropy^1.4 csr^1.5 charity^1.2 foundation^1.3 nonprofit^1.2 donate^1.3 donation^1.3 grant^1.2 grantmaking^1.4 ' +
      'sponsor^0.7 sponsorship^0.7 fund^0.7 funding^0.7 invest^1.0 partner^1.0 supplier^1.0 manufacturer^1.1 marketing^1.0 hr^1.0',
    phrases: [
      // Deliberately light: "does our company have to pay?" is a question about price that happens
      // to name a company, and a heavy weight here used to route it to the wrong answer.
      'our company^1.2',
      'my company^1.2',
      'my business^1.8',
      'our business^1.8',
      'i own^1.5',
      // Not "i work at": people write "i also work at", and a phrase is strict about adjacency.
      'work at^1.4',
      'work for^1.4',
      'we sponsor^1.8',
      'we want to sponsor^2',
      'we fund^1.5',
      'give back^1.4',
      'represent a company^2.4',
      'on behalf of^1.3',
      'support teams^1.2',
      'receive pitches^1.6',
    ],
  },
  {
    id: 'cost',
    text: 'It is free. There are no fees for teams or for companies, and no money moves through FTC Pitfund — you arrange the sponsorship directly between yourselves.',
    cta: 'Read the FAQ',
    href: '#faq',
    also: 'What it costs',
    terms:
      'free^1.6 cost^1.6 price^1.6 pricing^1.6 pay^1.4 payment^1.4 fee^1.6 charge^1.3 subscription^1.5 billing^1.5 invoice^1.4 ' +
      'money^1.1 dollar^1.1 expensive^1.4 afford^1.2 cheap^1.3 trial^1.2 commission^1.4 card^1.1 budget^0.6 plan^0.6',
    phrases: ['how much^1.8', 'does it cost^1.8', 'is it free^2', 'credit card^1.7', 'hidden fee^1.7', 'take a cut^1.7', 'free for teams^1.6'],
  },
  {
    id: 'review',
    text: 'A Pitfund reviewer reads every pitch before the company sees it, and sends it back with one note when something needs work. Teams and companies are checked the same way.',
    cta: 'How review works',
    href: '#bento-review',
    also: 'How review works',
    terms:
      'review^1.6 reviewer^1.5 approve^1.4 approval^1.4 reject^1.4 decline^1.1 moderate^1.4 moderator^1.4 vet^1.3 proofread^1.4 ' +
      'quality^1.2 feedback^1.3 note^1.0 human^1.3 admin^1.2 pending^1.3 screen^1.0 edit^0.9 check^0.9',
    phrases: ['read every pitch^1.8', 'who checks^1.6', 'who reviews^1.6', 'reviews the pitches^1.6', 'sent back^1.5', 'before it goes^1.5', 'how long^1.0'],
  },
  {
    id: 'adults',
    text: 'Accounts are for adults — coaches, mentors and parents. Students are not given logins; the team page and the deck are how the students are represented.',
    cta: 'Read the FAQ',
    href: '#faq',
    also: 'Who can have an account',
    terms: 'student^1.6 kid^1.5 child^1.5 children^1.5 youth^1.5 teen^1.5 teenager^1.5 minor^1.4 adult^1.5 captain^1.2 age^1.1',
    phrases: ['high school^1.5', 'middle school^1.5', 'under 18^2', 'my kid^1.8', 'student account^2.2', 'can students^2', 'the students^1.2'],
  },
  {
    id: 'deck',
    text: 'A deck is one PDF, up to five pages and 10 MB, uploaded once with a one-line summary. The same deck goes out with every pitch you send that season.',
    cta: 'See how a pitch works',
    href: '#bento-pitch',
    also: 'What a deck is',
    terms:
      'deck^1.6 pdf^1.7 slide^1.5 presentation^1.5 document^1.3 file^1.3 upload^1.4 attach^1.3 mb^1.5 megabyte^1.5 ' +
      'template^1.4 brochure^1.4 portfolio^1.3 format^1.2 size^1.1 page^1.0 design^0.9 photo^0.9 image^0.9 logo^1.0',
    phrases: ['how many pages^1.8', 'file size^1.7', 'what goes in^1.4', 'too big^1.4'],
  },
  {
    id: 'privacy',
    text: 'Contact details stay private until a company answers Interested. Nothing you write is published, and only the two organizations in a match ever see each other’s contacts.',
    cta: 'Read the FAQ',
    href: '#faq',
    also: 'What stays private',
    terms:
      'privacy^1.6 private^1.6 confidential^1.6 secure^1.4 security^1.4 safe^1.3 spam^1.5 protect^1.4 gdpr^1.6 ' +
      'data^1.2 contact^1.2 email^1.0 phone^1.1 address^1.1 visible^1.2 public^0.9 delete^1.2 store^1.1 sell^1.4',
    phrases: ['who can see^2', 'my email^1.5', 'personal information^1.7', 'is it safe^1.7', 'kept private^1.8'],
  },
  {
    id: 'coach',
    text: 'Sounds like you are on the team side. Verify your team, upload one deck, and pitch any approved company — a person reads every pitch before it lands.',
    cta: 'I coach a team',
    href: '/login?intent=team',
    also: 'I coach a team',
    terms:
      'coach^1.6 mentor^1.5 parent^1.3 rookie^1.5 club^1.1 team^1.1 ' +
      'robot^1.3 robotics^1.3 ftc^1.5 competition^1.2 tournament^1.2 championship^1.3 qualifier^1.4 regional^1.2 worlds^1.3 ' +
      'kit^1.3 travel^1.1 outreach^1.2 stem^1.1 fundraising^1.4 fundraise^1.4 registration^1.1 season^0.7 pitch^0.7 build^0.8 part^0.7',
    phrases: [
      'i coach^2.2',
      // Naming your team isn't the same as asking to join: plenty of questions about the rules,
      // the deck or the price start "our team …", so this leans, it doesn't decide.
      'our team^1.5',
      'my team^1.5',
      'we are a team^2',
      'i mentor^2',
      'need a sponsor^2',
      'find a sponsor^2',
      'looking for sponsors^2',
      'get sponsors^1.8',
      'reach companies^1.6',
      'raise money^1.6',
      'we need help^1.3',
      'help paying^1.6',
      'first tech challenge^1.8',
    ],
  },
  {
    id: 'account',
    text: 'There is no password to create: you sign in with Google or with a 6-digit code emailed to you. One account per person, and one shared account per team or company.',
    cta: 'Sign in',
    href: '/login',
    also: 'How signing in works',
    // Second-factor words are left out on purpose even though people ask about them: that is a
    // non-goal, `npm run security:scan` greps app code for it, and a keyword list is not worth an
    // allowlist entry that blunts the guard. Those questions still land here on the `sign in` phrase.
    terms: 'password^1.7 login^1.3 signin^1.4 signup^1.3 register^1.4 google^1.4 otp^1.5 authenticate^1.4 passwordless^1.7',
    phrases: ['sign in^1.5', 'log in^1.6', 'sign up^1.4', 'create an account^1.6', 'need a password^2', 'email code^1.8', 'forgot my^1.6'],
  },
  {
    id: 'season',
    text: 'One pitch per team, per company, per season — the season turns over on September 1. Withdrawing a pitch before the company answers frees the slot again.',
    cta: 'See how it works',
    href: '#stages',
    also: 'The one-pitch rule',
    terms: 'withdraw^1.6 twice^1.8 limit^1.4 cap^1.3 resend^1.5 duplicate^1.5 multiple^1.3 deadline^1.4 september^1.5 again^1.1 cancel^1.2 several^1.1',
    phrases: ['how many pitches^2', 'more than one^1.7', 'same company^1.7', 'same company twice^2.2', 'per season^1.7', 'pitch again^1.8', 'change my mind^1.6'],
  },
  {
    id: 'verified',
    text: 'A team proves it is real with a screenshot of its FIRST Dashboard. An admin checks it once, and from then on the team shows as verified everywhere it appears.',
    cta: 'How verifying works',
    href: '#bento-verified',
    also: 'Verifying a team',
    terms: 'verify^1.6 verified^1.6 verification^1.6 dashboard^1.5 screenshot^1.6 proof^1.5 prove^1.5 legit^1.4 identity^1.3 eligible^1.3 fake^1.4',
    phrases: ['first dashboard^2.2', 'team number^1.5', 'how do you know^1.5'],
  },
  {
    id: 'public',
    text: 'Every approved team gets a public page with its summary, deck and links. Set it up once and share that one link anywhere you like.',
    cta: 'See a team page',
    href: '#bento-public',
    also: 'Team pages',
    terms: 'url^1.4 website^1.4 profile^1.3 link^1.2 seo^1.4 embed^1.3 share^0.9',
    phrases: ['team page^2.2', 'public page^2.2', 'our page^1.6', 'our own site^1.4'],
  },
  {
    id: 'questions',
    text: 'Each company writes up to ten of its own questions, and gets three good defaults if it would rather not. Teams answer those questions instead of a generic form.',
    cta: 'See how questions work',
    href: '#bento-questions',
    also: 'The questions',
    terms: 'question^1.5 prompt^1.4 essay^1.4 form^1.2 answer^1.2 field^1.2 application^1.3 default^1.3 custom^1.3 ask^1.0',
    phrases: ['what questions^1.8', 'our questions^1.8', 'how many questions^2', 'what do we ask^1.7'],
  },
  {
    id: 'members',
    text: 'A team or company is one shared account. One person owns it and invites the others as editors; everyone then sees the same pitches.',
    cta: 'Read the FAQ',
    href: '#faq',
    also: 'Adding people',
    terms: 'invite^1.6 invitation^1.6 colleague^1.5 teammate^1.4 seat^1.3 owner^1.4 ownership^1.4 permission^1.4 role^1.3 transfer^1.2 remove^1.2 access^1.0',
    phrases: ['add someone^1.6', 'more than one person^1.8', 'other coaches^1.6', 'my colleague^1.7', 'co coach^1.6'],
  },
  {
    id: 'howitworks',
    text: 'Four steps: set your team or company up, write the pitch against the questions, a reviewer reads it, and the company answers Interested or Not a fit.',
    cta: 'See how it works',
    href: '#stages',
    also: 'The short version',
    // "work" carries this on its own: "how does this whole thing work" puts too many words between
    // "how" and "work" for any phrase to catch, and nothing else on the page competes for the word.
    terms: 'step^1.3 process^1.4 overview^1.4 timeline^1.4 stage^1.3 explain^1.3 happen^1.2 work^1.1 next^0.9 start^0.8',
    phrases: ['how does it work^2', 'how it works^2', 'what happens^1.6', 'where do i start^1.8', 'what is this^1.6', 'getting started^1.5', 'new here^1.6'],
  },
]

/* ---------------------------------------------------------------- normalizing */

/*
 * Words that carry no intent here. Deliberately short: a long stoplist starts eating words that do
 * matter on this page ("first", "team", "page"), and the weights already handle the rest.
 */
const STOP = new Set(
  ('i we you it he she they me us them my our your their this that these those a an the and or but if so as at by for from in into of on to with about ' +
    'is am are was were be been being do does did done have has had will would can could should may might must there here what which who whom whose when where why how ' +
    'not no yes just any some very really please thanks thank hi hello hey ok okay')
    .split(' ')
    .filter(Boolean),
)

/** Determiners are dropped from phrases on both sides, so "need a sponsor" also matches "need sponsors". */
const DETERMINER = new Set(['a', 'an', 'the'])

/**
 * Enough of a stemmer to fold plurals and verb forms together. Derivations ("review" / "reviewer",
 * "sponsor" / "sponsorship") are left to prefix matching, and typos to edit distance, so this stays
 * small and predictable — whatever it does, it does identically to the index and to the query.
 */
export function stem(word: string): string {
  let s = word
  if (s.length > 4 && s.endsWith('ies')) s = `${s.slice(0, -3)}i`
  else if (s.length > 4 && /(?:s|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2)
  else if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3)
  else if (s.length > 4 && s.endsWith('ed') && !s.endsWith('eed')) s = s.slice(0, -2)
  else if (s.length > 3 && s.endsWith('s') && !/(?:ss|us|is)$/.test(s)) s = s.slice(0, -1)
  if (s.length > 3 && /[^aeiou]y$/.test(s)) s = `${s.slice(0, -1)}i`
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1)
  return s
}

type Word = { raw: string; stem: string }

/*
 * Lowercase, fold the curly apostrophe, split on anything that isn't a letter or digit. The raw word
 * is kept beside its stem because the two together tolerate more typos than either alone: "compnay"
 * doesn't stem the way "company" does (the stemmer only folds a `y` after a consonant), so the stems
 * are two edits apart while the raw words are one.
 */
function words(text: string): Word[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((raw) => ({ raw, stem: stem(raw) }))
}

/* ---------------------------------------------------------------- matching */

/*
 * Edit distance, abandoned as soon as a whole row is over `max`, and counting a swapped pair of
 * letters as one edit rather than two: "reveiw" and "teh" are the single most common way to
 * mistype a word, and plain Levenshtein scores them the same as two unrelated substitutions.
 * Only ever called on tokens that missed the exact index.
 */
function within(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let twoBack: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, twoBack[j - 2] + 1)
      row.push(v)
      if (v < best) best = v
    }
    if (best > max) return max + 1
    twoBack = prev
    prev = row
  }
  return prev[b.length]
}

/** How much of a term's weight a query token earns: exact, then prefix, then one or two typos. */
function similarity(token: string, term: string): number {
  if (token === term) return 1
  const shortest = Math.min(token.length, term.length)
  if (shortest >= 4 && (token.startsWith(term) || term.startsWith(token))) return 0.88
  const longest = Math.max(token.length, term.length)
  if (longest < 5) return 0
  const d = within(token, term, longest >= 8 ? 2 : 1)
  if (d === 1) return 0.75
  if (d === 2 && longest >= 8) return 0.5
  return 0
}

type Term = { raw: string; stem: string; weight: number }
type Indexed = FindIntent & { terms: Term[]; phrases: Array<[string, number]> }

/** Splits `word^1.4` into the word and its weight (1 when there is no `^`). */
function weighed(entry: string): [string, number] {
  const at = entry.lastIndexOf('^')
  return at > 0 ? [entry.slice(0, at), Number(entry.slice(at + 1))] : [entry, 1]
}

const INTENTS: Indexed[] = AUTHORED.map(({ terms, phrases = [], ...rest }) => ({
  ...rest,
  terms: terms
    .split(' ')
    .filter(Boolean)
    .map((entry) => {
      const [word, weight] = weighed(entry)
      return { ...words(word)[0], weight }
    }),
  // A phrase is stored the way a query will look by the time it gets here: stemmed, determiners
  // dropped from both sides so "need a sponsor" also catches "needs sponsors".
  phrases: phrases.map((entry) => {
    const [text, weight] = weighed(entry)
    return [
      words(text)
        .map((w) => w.stem)
        .filter((w) => !DETERMINER.has(w))
        .join(' '),
      weight,
    ] as [string, number]
  }),
}))

/** Exact hits are the common case, so they skip the per-term scan entirely. */
const EXACT = new Map<string, Array<[number, number]>>()
INTENTS.forEach((intent, i) => {
  for (const term of intent.terms) {
    const list = EXACT.get(term.stem)
    if (list) list.push([i, term.weight])
    else EXACT.set(term.stem, [[i, term.weight]])
  }
})

export type FindMatch = {
  intent: FindIntent
  /** 0–1, for the strength ring. Not a probability, just "how much did this sentence say". */
  confidence: number
  /** Offered alongside the winner when the two are close enough that we might have it backwards. */
  runnerUp?: FindIntent
}

/** The index entries carry their word lists; callers only ever want the answer. */
function plain({ id, text, cta, href, also }: Indexed): FindIntent {
  return { id, text, cta, href, also }
}

/** Below this the sentence hasn't said anything we recognise, and guessing is worse than asking. */
const MIN_SCORE = 0.9
/** The runner-up is worth offering from here up — close enough that the visitor should get to choose. */
const CLOSE_ENOUGH = 0.7

/**
 * Score every intent against the sentence and return the best, or null when nothing scores.
 * Nothing here touches the DOM, the network or storage — it is a pure function of the string.
 */
export function matchIntent(query: string): FindMatch | null {
  const all = words(query)
  if (!all.length) return null
  // Phrases match the full stemmed sequence (determiners dropped) so word order still counts;
  // single terms match the content words only, deduped so repetition can't inflate a score.
  const sequence = ` ${all.map((w) => w.stem).filter((w) => !DETERMINER.has(w)).join(' ')} `
  const seen = new Set<string>()
  const tokens = all.filter((w) => !STOP.has(w.stem) && !seen.has(w.stem) && seen.add(w.stem))

  const scores = new Array<number>(INTENTS.length).fill(0)
  for (const token of tokens) {
    const exact = EXACT.get(token.stem)
    if (exact) {
      for (const [i, weight] of exact) scores[i] += weight
      continue
    }
    for (let i = 0; i < INTENTS.length; i++) {
      let best = 0
      for (const term of INTENTS[i].terms) {
        const s = Math.max(similarity(token.stem, term.stem), similarity(token.raw, term.raw)) * term.weight
        if (s > best) best = s
      }
      scores[i] += best
    }
  }
  for (let i = 0; i < INTENTS.length; i++) {
    for (const [phrase, weight] of INTENTS[i].phrases) {
      if (phrase && sequence.includes(` ${phrase} `)) scores[i] += weight
    }
  }

  let top = -1
  let second = -1
  for (let i = 0; i < scores.length; i++) {
    if (top < 0 || scores[i] > scores[top]) {
      second = top
      top = i
    } else if (second < 0 || scores[i] > scores[second]) second = i
  }
  if (top < 0 || scores[top] < MIN_SCORE) return null

  const close = second >= 0 && scores[second] >= MIN_SCORE && scores[second] >= scores[top] * CLOSE_ENOUGH
  return {
    intent: plain(INTENTS[top]),
    confidence: Math.min(1, scores[top] / 2.6),
    runnerUp: close ? plain(INTENTS[second]) : undefined,
  }
}

/** Exported for the test only: the ids, so the corpus can name what it expects. */
export const INTENT_IDS = INTENTS.map((i) => i.id)

