/*
 * Copy for the homepage. Everything here is a real product rule or a real flow: no invented customers,
 * stats or quotes. The product windows use sample teams and companies, which are illustrations of the UI,
 * never claims about who uses it. Links go to real routes or to anchors on this page.
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

/* The nav's Product menu: what each side gets, then the ways in. */
export const MENU = {
  columns: [
    {
      heading: 'For teams',
      items: [
        { title: 'Team page', body: 'One profile, reused all season', href: '#team-page' },
        { title: 'Pitch a company', body: 'Answer their own questions', href: '#pitch' },
        { title: 'Verification', body: 'Checked against FIRST', href: '#team-page' },
      ],
    },
    {
      heading: 'For companies',
      items: [
        { title: 'Your questions', body: 'Up to ten, or three defaults', href: '#pitch' },
        { title: 'Reviewed pitches', body: 'A person reads each one first', href: '#review' },
        { title: 'One-click answers', body: 'Interested or Not a fit', href: '#answers' },
      ],
    },
    {
      heading: 'Privacy',
      items: [
        { title: 'What’s shared, and when', body: 'Public page, pitch, contacts', href: '#shared' },
        { title: 'Matching', body: 'Contacts only on Interested', href: '#matched' },
        { title: 'The season', body: 'One pitch per company', href: '#season' },
      ],
    },
  ],
  aside: [
    { heading: 'Get started', links: [
      ['I coach a team', TEAM_HREF],
      ['I represent a company', COMPANY_HREF],
      ['Find where to start', '#find'],
    ] },
    { heading: 'Help', links: [
      ['FAQ', '#faq'],
      ['Sign in', '/login'],
    ] },
  ],
} as const

/* The five chapters of "How it works", each a statement over a product panel (sections.tsx). */
export const CHAPTERS = [
  {
    id: 'team-page',
    nav: 'Set up your team',
    lead: 'Set up once.',
    rest: 'Verify your number against FIRST, upload a deck of up to five pages and write one line about your team. Every pitch this season reuses it.',
    cells: [
      { title: 'Checked against FIRST.', body: 'Your number has to be on FIRST’s list, and a reviewer checks your Dashboard screenshot before anyone sees you.' },
      { title: 'A link you can send anywhere.', body: 'Every approved team gets a public page with its logo, summary and deck, on or off FTC Pitfund.' },
    ],
  },
  {
    id: 'pitch',
    nav: 'Pitch a company',
    lead: 'Their questions, not a form.',
    rest: 'Each approved company writes up to ten questions, or keeps three good defaults. You answer exactly those, and drafts save as you type.',
    cells: null,
  },
  {
    id: 'review',
    nav: 'Reviewed first',
    lead: 'A person reads it first.',
    rest: 'Every pitch is read by a reviewer before the company sees it. If something is missing, it comes back with a note on what to fix.',
    cells: [
      { title: 'A note, never a silent no.', body: 'Returned pitches say exactly what to change. Fix it, resubmit, and it goes back to the front of the queue.' },
      { title: 'Companies are checked too.', body: 'Teams only ever see companies a reviewer has approved. Pending companies are invisible.' },
    ],
  },
  {
    id: 'answers',
    nav: 'The company answers',
    lead: 'Interested, or not a fit.',
    rest: 'Companies see only reviewed pitches and answer each one with a click. No limbo, and no chasing a reply for weeks.',
    cells: null,
  },
  {
    id: 'matched',
    nav: 'Matched',
    lead: 'Contacts, only on a match.',
    rest: 'When a company says Interested, the two of you see each other’s details. Nobody else does, and no money moves through FTC Pitfund.',
    cells: [
      { title: 'One pitch per company, per season.', body: 'Seasons start September 1. Withdraw before a reply and the slot is yours again.' },
      { title: 'Run it as a team.', body: 'One shared account per team or company. An owner invites people; editors do everything else.' },
    ],
  },
] as const

/* The dark section's five rules, one column each. */
export const RULES = [
  { title: 'Adults only.', body: 'Coaches, mentors and parents. No student accounts.' },
  { title: 'Verified teams.', body: 'Every number checked against FIRST’s own list.' },
  { title: 'Approved companies.', body: 'Teams only pitch companies a reviewer approved.' },
  { title: 'Private contacts.', body: 'Shared on Interested, only between the two of you.' },
  { title: 'No money moves.', body: 'Free for both sides. You arrange it directly.' },
] as const

/* "What's shared, and when": three tabs, each a ring in the diagram beside them (sections.tsx). */
export const SHARED = [
  { id: 'public', title: 'Your team page', body: 'Name, number, logo, one-line summary and deck. Public, so you can send the link to anyone.' },
  { id: 'pitch', title: 'Your pitch', body: 'Your answers go to the one company you pitched, and only after a reviewer has read them.' },
  { id: 'contacts', title: 'Your contacts', body: 'Names, emails and phone numbers. Shared only when a company says Interested, only between you two.' },
] as const

/* The two sides, as tabs above a panel (sections.tsx). */
export const SIDES = [
  {
    id: 'teams',
    tab: 'For teams',
    overline: 'Coaches and mentors',
    lead: 'Pitch every approved sponsor from one team account.',
    checks: ['Team number matched to FIRST', 'One deck and summary, reused all season', 'Drafts that save as you type', 'Withdraw before a reply to free the slot'],
    cta: { label: 'I coach a team', href: TEAM_HREF },
  },
  {
    id: 'companies',
    tab: 'For companies',
    overline: 'Companies that sponsor robotics',
    lead: 'Screened, specific pitches you answer with a click.',
    checks: ['Up to ten questions of your own', 'Only reviewed pitches reach you', 'Interested or Not a fit, nothing in between', 'Invite colleagues as editors'],
    cta: { label: 'I represent a company', href: COMPANY_HREF },
  },
] as const
