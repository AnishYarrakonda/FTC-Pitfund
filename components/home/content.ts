/*
 * Copy for the homepage. Everything here is a real product rule or a real flow: no invented
 * customers, stats or quotes. Links go to real routes or to anchors on this page.
 */

export const TEAM_HREF = '/login?intent=team'
export const COMPANY_HREF = '/login?intent=company'

export const FAQS = [
  {
    id: 'shared',
    q: 'What gets shared and when?',
    a: 'Your team page (name, number, logo, summary and deck) is public. A pitch’s answers go only to the company you pitched, after review. Names, emails and phone numbers are shared only when a company says Interested, and only between that team and that company.',
  },
  {
    id: 'reviewers',
    q: 'Who reviews pitches?',
    a: 'The FTC Pitfund reviewers, run by FTC Team 31579 Exodius. They read every pitch before a company sees it and either send it on or return it with a note saying what to fix. They also approve each company before teams can pitch it.',
  },
  { id: 'free', q: 'Is it free?', a: 'Yes, for teams and companies. FTC Pitfund never handles money: when a company is interested, you arrange the sponsorship directly with each other.' },
  {
    id: 'students',
    q: 'Can students use it?',
    a: 'No. Accounts are for adults: coaches, mentors and parents who handle sponsorship. Students don’t need an account to be represented; the team page and deck speak for the team.',
  },
  {
    id: 'changes',
    q: 'What if a pitch needs changes?',
    a: 'The reviewer sends it back with a note on what to fix. It isn’t a rejection: you edit and resubmit, and it goes back to the front of the review queue.',
  },
  {
    id: 'photos',
    q: 'What about photos of students?',
    a: 'Whoever uploads a deck confirms they have permission to share any photos of people in it. Anyone can report a team page, and a reviewer takes down anything that shouldn’t be there.',
  },
  {
    id: 'verify',
    q: 'What if our team isn’t found?',
    a: 'Double-check your team number against FIRST’s own records first, since a typo is the most common cause. If it still doesn’t match, email us and a reviewer will look into it by hand.',
  },
  { id: 'first', q: 'Is this run by FIRST?', a: 'No. FTC Pitfund is an independent project built by FTC Team 31579 Exodius. It is not affiliated with or endorsed by FIRST®.' },
] as const

export type FeatureIcon = 'send' | 'question' | 'eye' | 'shield' | 'file' | 'check'

/* The six things FTC Pitfund does, as the homepage's feature grid shows them. */
export const FEATURES: Array<{ id: string; tag: string; icon: FeatureIcon; title: string; body: string }> = [
  {
    id: 'pitch',
    tag: 'Pitches',
    icon: 'send',
    title: 'Pitch approved companies, on the record',
    body: 'Build one team profile, then pitch any approved company that sponsors robotics. Drafts save as you write, and every pitch ends in a clear yes or no.',
  },
  {
    id: 'questions',
    tag: 'Questions',
    icon: 'question',
    title: 'Each company asks its own questions',
    body: 'Companies write up to ten questions, or keep three good defaults. Teams answer exactly those, so no two companies get the same generic form.',
  },
  {
    id: 'review',
    tag: 'Review',
    icon: 'eye',
    title: 'A person reads every pitch first',
    body: 'A reviewer reads each pitch before any company sees it. Anything missing goes back to the team with a note on what to fix, never a silent rejection.',
  },
  {
    id: 'verified',
    tag: 'Verification',
    icon: 'shield',
    title: 'Teams checked against FIRST records',
    body: 'A team proves itself with its number and a FIRST Dashboard screenshot. Until a reviewer approves it, nothing about the team is reachable.',
  },
  {
    id: 'public',
    tag: 'Team pages',
    icon: 'file',
    title: 'A public team page you can send anywhere',
    body: 'Every approved team gets a page with its logo, one-line summary and a deck of up to five pages. Send the link to anyone, on or off FTC Pitfund.',
  },
  {
    id: 'match',
    tag: 'Matching',
    icon: 'check',
    title: 'Contacts are exchanged only on Interested',
    body: 'A company answers Interested or Not a fit. Interested shares contact details between that team and that company: nothing before, nobody else.',
  },
]

/* The two sides of a sponsorship, each with what it gets and its door in. */
export const SIDES = [
  {
    id: 'teams',
    label: 'For teams',
    title: 'Pitch every approved sponsor from one team account',
    body: 'Verify your team once, upload one deck, and every approved company is a pitch away.',
    checks: ['Team number matched to FIRST', 'One deck and summary, reused all season', 'Autosaved drafts', 'One pitch per company per season', 'Withdraw before a reply to free the slot'],
    cta: { label: 'I coach a team', href: TEAM_HREF },
  },
  {
    id: 'companies',
    label: 'For companies',
    title: 'An inbox of screened, specific pitches',
    body: 'Write the questions you care about and let approved teams answer them. You answer each pitch with a click.',
    checks: ['Up to ten questions of your own', 'Only reviewed pitches reach you', 'Interested or Not a fit, nothing in between', 'Invite colleagues as editors', 'Free, and no money moves through us'],
    cta: { label: 'I represent a company', href: COMPANY_HREF },
  },
] as const

export const STATS = [
  { value: '1', label: 'pitch per team, per company, per season' },
  { value: '100%', label: 'of pitches read by a person before a company sees them' },
  { value: '≤10', label: 'questions each company writes for itself' },
  { value: '$0', label: 'in fees for teams and companies' },
] as const

export const STAGES = [
  {
    key: 'draft',
    mark: 'D',
    color: '#8a8a8a',
    title: 'Set up your team page once and reuse it all season.',
    image: '/marketing/team-page.webp',
    alt: 'A public team page on FTC Pitfund with the team’s logo, summary and sponsorship deck',
    data: [
      ['5 pages', 'maximum deck length, as one PDF'],
      ['10 MB', 'maximum deck size'],
      ['Used in', 'every pitch you send this season'],
    ],
  },
  {
    key: 'review',
    mark: 'R',
    color: '#8ab4ff',
    title: 'A reviewer reads every pitch before a company does.',
    image: '/marketing/composer.webp',
    alt: 'The pitch composer: a company’s questions on the left, a preview of what the company will see on the right',
    data: [
      ['100%', 'of pitches reviewed by a person'],
      ['1 note', 'on what to fix, when one is needed'],
      ['Checked', 'teams, companies and pitches alike'],
    ],
  },
  {
    key: 'sent',
    mark: 'Q',
    color: '#ffff8b',
    title: 'Answer the questions each sponsor actually asked.',
    image: '/marketing/composer.webp',
    alt: 'A pitch being written against a company’s own questions',
    data: [
      ['≤10', 'questions per company'],
      ['3', 'good defaults when a company skips it'],
      ['Autosaved', 'drafts, so nothing is lost'],
    ],
  },
  {
    key: 'matched',
    mark: 'M',
    color: '#5fd68f',
    title: 'Interested? Contacts are exchanged between you two.',
    image: '/marketing/inbox-pitch.webp',
    alt: 'A company’s inbox showing a reviewed pitch with Interested and Not a fit buttons',
    data: [
      ['2', 'answers: Interested or Not a fit'],
      ['Private', 'contacts until Interested'],
      ['$0', 'handled by us, ever'],
    ],
  },
] as const

