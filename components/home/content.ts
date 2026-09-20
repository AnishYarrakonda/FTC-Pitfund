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

export type BentoKey = 'pitch' | 'questions' | 'review' | 'verified' | 'public' | 'match'

export const SHORT: Record<BentoKey, string> = {
  pitch: 'Pitch approved companies, online and on the record',
  questions: 'Ask the questions you care about',
  review: 'Every pitch is read by a person first',
  verified: 'Teams verified against FIRST records',
  public: 'A public team page you can send anywhere',
  match: 'Interested? Contacts are exchanged, only then',
}

export const BENTO: Record<
  BentoKey,
  {
    title: string
    lede: string
    accent: string
    checks: string[]
    features: Array<{ icon: 'gauge' | 'loop' | 'grid' | 'shield' | 'mail' | 'user'; text: string }>
    primary: { label: string; href: string }
  }
> = {
  pitch: {
    title: 'Pitch approved companies, online and on the record',
    lede: 'Build one team profile, then pitch any approved company that sponsors robotics. Every pitch is saved as you write it, tracked through review, and answered with a clear yes or no.',
    accent: '#10b981',
    checks: ['Pitch any approved company', 'One pitch per company per season', 'Autosaved drafts', 'Withdraw before a reply to free the slot'],
    features: [
      { icon: 'grid', text: 'Reuse one deck and one summary for every pitch you send this season.' },
      { icon: 'loop', text: 'See each pitch move from draft to review to sent to answered, in one list.' },
      { icon: 'mail', text: 'Every change lands in your notifications, with an email copy when it matters.' },
    ],
    primary: { label: 'I coach a team', href: TEAM_HREF },
  },
  questions: {
    title: 'Ask the questions you actually care about',
    lede: 'Each company writes its own questions, up to ten, or keeps three good defaults. Teams answer exactly those, so no two companies get the same generic form.',
    accent: '#84cc16',
    checks: ['Up to ten questions', 'Three defaults if you skip it', 'Answers reviewed before you see them', 'Change questions any time'],
    features: [
      { icon: 'gauge', text: 'Decide what you need to know: budget, outreach, team history, anything.' },
      { icon: 'loop', text: 'New questions apply to new pitches. Pitches already sent keep theirs.' },
      { icon: 'grid', text: 'Read every answer beside the team’s deck and public page.' },
    ],
    primary: { label: 'Set up your company', href: COMPANY_HREF },
  },
  review: {
    title: 'Every pitch is read by a person first',
    lede: 'A reviewer reads each pitch before any company sees it. Something missing goes back to the team with a note on what to fix, never a silent rejection.',
    accent: '#1e40af',
    checks: ['Human review, not an algorithm', 'Notes that say what to fix', 'Resubmits go to the front', 'Companies see only reviewed pitches'],
    features: [
      { icon: 'shield', text: 'Teams and companies are approved before they reach the app at all.' },
      { icon: 'user', text: 'Reviewers are run by FTC Team 31579 Exodius.' },
      { icon: 'mail', text: 'Both sides are notified the moment a decision is made.' },
    ],
    primary: { label: 'I coach a team', href: TEAM_HREF },
  },
  verified: {
    title: 'Teams verified against FIRST records',
    lede: 'A team proves itself with its team number and a FIRST Dashboard screenshot. Until a reviewer approves it, nothing about the team is reachable, including its public page.',
    accent: '#3b82f6',
    checks: ['Team number matched to FIRST', 'Screenshot kept private', 'Adults only, no student accounts', 'One owner per team account'],
    features: [
      { icon: 'shield', text: 'Proof lives in a private bucket and is deleted on approval.' },
      { icon: 'user', text: 'Owners invite editors, remove them, and hand ownership on.' },
      { icon: 'grid', text: 'Companies are approved the same way before teams can pitch them.' },
    ],
    primary: { label: 'Verify your team', href: TEAM_HREF },
  },
  public: {
    title: 'A public team page you can send anywhere',
    lede: 'Every approved team gets a page with its name, number, logo, one-line summary and deck. Send the link to anyone, on or off FTC Pitfund.',
    accent: '#00d4ff',
    checks: ['Deck up to five pages', 'PDF up to 10 MB', 'One-line summary', 'Anyone can report a page'],
    features: [
      { icon: 'grid', text: 'The deck opens in the browser, page by page, and downloads as a PDF.' },
      { icon: 'loop', text: 'Replace the deck any time; the page updates at once.' },
      { icon: 'shield', text: 'Only approved teams have a page. Nothing else is public.' },
    ],
    primary: { label: 'Build your team page', href: TEAM_HREF },
  },
  match: {
    title: 'Interested? Contacts are exchanged, only then',
    lede: 'A company answers Interested or Not a fit. Interested exchanges contact details between that team and that company: nothing before, and nothing with anyone else.',
    accent: '#eab308',
    checks: ['Two clear answers', 'Contacts only on a match', 'Only the two orgs involved', 'No money moves through us'],
    features: [
      { icon: 'user', text: 'Names, emails and phone numbers stay private until Interested.' },
      { icon: 'mail', text: 'Both sides get the other’s contacts in the app and by email.' },
      { icon: 'gauge', text: 'Arrange the sponsorship directly, however suits you both.' },
    ],
    primary: { label: 'Set up your company', href: COMPANY_HREF },
  },
}

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
    color: '#1e40af',
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
    color: '#3b82f6',
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
    color: '#84cc16',
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
    color: '#00b261',
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

