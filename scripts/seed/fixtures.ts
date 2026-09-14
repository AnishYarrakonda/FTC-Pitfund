/*
 * The seeded world: realistic teams, companies and pitch content. Fictional except team 31579
 * (Exodius), the team that built FTC Pitfund.
 */
import type { PitchStatus } from '@/lib/server/schema'
import { personaEmail, PERSONAS, type PersonaKey } from '@/lib/shared/personas'
import type { Question } from '@/lib/shared/questions'

import type { SeedUser } from './base'

type Shape = 'circle' | 'ring' | 'diamond' | 'bars' | 'chevron' | 'hex'

export const PERSONA_USERS: SeedUser[] = PERSONAS.map((p) => ({
  key: p.key,
  email: personaEmail(p.key),
  name: p.name,
  isAdmin: p.key === 'admin',
  jobTitle:
    p.key === 'sponsor'
      ? 'Community Partnerships Lead'
      : p.key === 'sponsor2'
        ? 'Marketing Director'
        : p.key === 'sponsor-pending'
          ? 'Head of People'
          : undefined,
  phone: p.key === 'coach' ? '(512) 555-0142' : p.key === 'sponsor' ? '(512) 555-0199' : undefined,
}))

export type TeamFixture = {
  number: number
  name: string
  city: string
  state: string
  color: string
  shape: Shape
  verified: boolean
  pages: number | null
  summary: string | null
  website: string | null
  members: Array<PersonaKey | { email: string; name: string }>
  recordStatus: 'matched' | 'manual' | 'unchecked'
}

const member = (slug: string, name: string) => ({ email: `member-${slug}@pitfund.test`, name })

export const TEAMS: TeamFixture[] = [
  {
    number: 31579,
    name: 'Exodius',
    city: 'Austin',
    state: 'TX',
    color: '#1F6F5C',
    shape: 'chevron',
    verified: true,
    pages: 4,
    summary: 'Third-year Austin community team building a fast, reliable robot and free workshops for 600+ local students.',
    website: 'https://exodiusftc.com',
    members: ['coach', member('exodius', 'Leah Okafor')],
    recordStatus: 'matched',
  },
  {
    number: 24890,
    name: 'Voltage Vultures',
    city: 'Portland',
    state: 'OR',
    color: '#9A3412',
    shape: 'bars',
    verified: false,
    pages: 2,
    summary: 'A second-year team from a Title I high school, focused on getting every student to a competition.',
    website: null,
    members: ['coach-unverified'],
    recordStatus: 'matched',
  },
  {
    number: 16072,
    name: 'Gear Grinders',
    city: 'Columbus',
    state: 'OH',
    color: '#1D4ED8',
    shape: 'hex',
    verified: true,
    pages: 5,
    summary: 'Veteran team and two-time state finalist that mentors four rookie teams across central Ohio.',
    website: 'https://example.org/geargrinders',
    members: [member('gear', 'Marcus Hill'), member('gear2', 'Dana Whitfield')],
    recordStatus: 'matched',
  },
  {
    number: 20443,
    name: 'Iron Lotus',
    city: 'San Jose',
    state: 'CA',
    color: '#7C3AED',
    shape: 'diamond',
    verified: true,
    pages: 3,
    summary: 'All-girls team pairing robotics with a summer coding camp for middle schoolers in East San Jose.',
    website: null,
    members: [member('lotus', 'Grace Liu')],
    recordStatus: 'matched',
  },
  {
    number: 18215,
    name: 'Quantum Quokkas',
    city: 'Raleigh',
    state: 'NC',
    color: '#B45309',
    shape: 'circle',
    verified: false,
    pages: 1,
    summary: 'Homeschool co-op team in its first season, learning CAD and building our first competition robot.',
    website: null,
    members: [member('quokkas', 'Ben Carter')],
    recordStatus: 'matched',
  },
  {
    number: 22761,
    name: 'Byte Knights',
    city: 'Denver',
    state: 'CO',
    color: '#0F766E',
    shape: 'ring',
    verified: true,
    pages: 3,
    summary: 'Software-heavy team known for its autonomous routines and an open-source vision library other teams use.',
    website: 'https://example.org/byteknights',
    members: [member('knights', 'Olivia Park')],
    recordStatus: 'matched',
  },
  {
    number: 14398,
    name: 'Tidal Robotics',
    city: 'Tampa',
    state: 'FL',
    color: '#0369A1',
    shape: 'bars',
    verified: false,
    pages: null,
    summary: null,
    website: null,
    members: [member('tidal', 'Chris Alvarez')],
    recordStatus: 'unchecked',
  },
  {
    number: 25530,
    name: 'Polar Pistons',
    city: 'Anchorage',
    state: 'AK',
    color: '#334155',
    shape: 'hex',
    verified: true,
    pages: 2,
    summary: 'Alaska’s northernmost FTC team. Travel to the state championship is our biggest cost every year.',
    website: null,
    members: [member('polar', 'Hannah Nguyen')],
    recordStatus: 'matched',
  },
  {
    number: 19904,
    name: 'Circuit Sages',
    city: 'Madison',
    state: 'WI',
    color: '#15803D',
    shape: 'diamond',
    verified: false,
    pages: 2,
    summary: 'Library-based team open to any student in the county, meeting three evenings a week.',
    website: null,
    members: [member('sages', 'Tom Becker')],
    recordStatus: 'manual',
  },
  {
    number: 27112,
    name: 'Sprocket Society',
    city: 'Boston',
    state: 'MA',
    color: '#BE123C',
    shape: 'circle',
    verified: true,
    pages: 4,
    summary: 'Urban team that builds from recycled parts and teaches repair skills at neighborhood maker fairs.',
    website: 'https://example.org/sprockets',
    members: [member('sprocket', 'Nia Johnson')],
    recordStatus: 'matched',
  },
]

export type SponsorFixture = {
  name: string
  website: string
  city: string
  state: string
  region: string
  color: string
  shape: Shape
  about: string
  supportTypes: Array<'funding' | 'equipment' | 'software' | 'mentorship' | 'other'>
  questions: Question[]
  status: 'approved' | 'pending' | 'rejected'
  statusNote?: string
  members: Array<PersonaKey | { email: string; name: string; jobTitle?: string }>
}

const q = (id: string, prompt: string, required = true, help?: string): Question => ({ id, prompt, required, help })

export const SPONSORS: SponsorFixture[] = [
  {
    name: 'Brightline Engineering',
    website: 'https://example.com/brightline',
    city: 'Austin',
    state: 'TX',
    region: 'Texas and the Southwest',
    color: '#1F2937',
    shape: 'chevron',
    about:
      'We sponsor teams that document their engineering process and bring robotics to students who would not otherwise see it. We fund registration and parts, and our engineers mentor.',
    supportTypes: ['funding', 'mentorship'],
    questions: [
      q('bl-process', 'Walk us through one design decision from last season. What did you try, and what changed?', true, 'A few sentences is plenty.'),
      q('bl-reach', 'Who does your team reach outside of competition?'),
      q('bl-budget', 'What would our funding pay for, specifically?'),
      q('bl-mentors', 'Would your team want an engineer from Brightline as a mentor?', false),
    ],
    status: 'approved',
    members: ['sponsor', { email: 'member-brightline@pitfund.test', name: 'Kevin Moore', jobTitle: 'Staff Engineer' }],
  },
  {
    name: 'Cedar Valley Credit Union',
    website: 'https://example.com/cedarvalley',
    city: 'Columbus',
    state: 'OH',
    region: 'Ohio',
    color: '#166534',
    shape: 'circle',
    about: 'A member-owned credit union supporting STEM education in the communities our members live in.',
    supportTypes: ['funding'],
    questions: [],
    status: 'approved',
    members: ['sponsor2'],
  },
  {
    name: 'Meridian Machine Works',
    website: 'https://example.com/meridian',
    city: 'Dayton',
    state: 'OH',
    region: 'Midwest',
    color: '#78350F',
    shape: 'hex',
    about: 'Precision CNC shop. We donate machining time and aluminum stock to robotics teams.',
    supportTypes: ['equipment'],
    questions: [q('mm-parts', 'Which parts would you want machined, and do you have CAD ready?')],
    status: 'approved',
    members: [{ email: 'member-meridian@pitfund.test', name: 'Rosa Delgado', jobTitle: 'Operations Manager' }],
  },
  {
    name: 'Northpeak Software',
    website: 'https://example.com/northpeak',
    city: 'Seattle',
    state: 'WA',
    region: 'Nationwide',
    color: '#1E3A8A',
    shape: 'ring',
    about: 'Developer tools company offering licenses, cloud credits and code reviews from our engineers.',
    supportTypes: ['software', 'mentorship'],
    questions: [],
    status: 'approved',
    members: [{ email: 'member-northpeak@pitfund.test', name: 'Aaron Fields', jobTitle: 'Developer Relations' }],
  },
  {
    name: 'Harbor Point Energy',
    website: 'https://example.com/harborpoint',
    city: 'Tampa',
    state: 'FL',
    region: 'Southeast',
    color: '#0E7490',
    shape: 'bars',
    about: 'Regional utility funding hands-on STEM programs in the counties we serve.',
    supportTypes: ['funding'],
    questions: [q('hp-county', 'Which county is your team based in?'), q('hp-students', 'How many students are on your team this season?')],
    status: 'approved',
    members: [{ email: 'member-harbor@pitfund.test', name: 'Janelle Ward', jobTitle: 'Community Relations' }],
  },
  {
    name: 'Ridgeway Aerospace',
    website: 'https://example.com/ridgeway',
    city: 'Denver',
    state: 'CO',
    region: 'Mountain West',
    color: '#312E81',
    shape: 'diamond',
    about: 'We support teams with funding and volunteer mentors from our flight software group.',
    supportTypes: ['funding', 'mentorship'],
    questions: [],
    status: 'approved',
    members: [{ email: 'member-ridgeway@pitfund.test', name: 'Victor Hsu', jobTitle: 'Program Manager' }],
  },
  {
    name: 'Summit Fabrication',
    website: 'https://example.com/summitfab',
    city: 'Portland',
    state: 'OR',
    region: 'Pacific Northwest',
    color: '#9F1239',
    shape: 'chevron',
    about: 'Sheet metal and laser cutting for teams in Oregon and Washington.',
    supportTypes: ['equipment'],
    questions: [],
    status: 'approved',
    members: [{ email: 'member-summit@pitfund.test', name: 'Megan Lowe', jobTitle: 'Owner' }],
  },
  {
    name: 'Lakeshore Medical Devices',
    website: 'https://example.com/lakeshore',
    city: 'Boston',
    state: 'MA',
    region: 'New England',
    color: '#155E75',
    shape: 'ring',
    about: 'Our employee giving program funds teams where our employees volunteer.',
    supportTypes: ['funding', 'other'],
    questions: [q('lm-volunteer', 'Does anyone at Lakeshore volunteer with your team?', false)],
    status: 'approved',
    members: [{ email: 'member-lakeshore@pitfund.test', name: 'Irene Walsh', jobTitle: 'Giving Program Lead' }],
  },
  {
    name: 'Atlas Components',
    website: 'https://example.com/atlas',
    city: 'Chicago',
    state: 'IL',
    region: 'Midwest',
    color: '#3F3F46',
    shape: 'hex',
    about: 'Electronics distributor interested in donating motors and sensors.',
    supportTypes: ['equipment'],
    questions: [],
    status: 'pending',
    members: ['sponsor-pending'],
  },
  {
    name: 'Greenfield Analytics',
    website: 'https://example.com/greenfield',
    city: 'Minneapolis',
    state: 'MN',
    region: 'Minnesota',
    color: '#4D7C0F',
    shape: 'bars',
    about: 'Data consultancy exploring a small sponsorship budget for local teams.',
    supportTypes: ['funding'],
    questions: [],
    status: 'pending',
    members: [{ email: 'member-greenfield@pitfund.test', name: 'Paul Ostrowski', jobTitle: 'Partner' }],
  },
  {
    name: 'QuickCash Promotions',
    website: 'https://example.com/quickcash',
    city: 'Las Vegas',
    state: 'NV',
    region: 'Nationwide',
    color: '#A16207',
    shape: 'circle',
    about: 'Promotional marketing.',
    supportTypes: ['other'],
    questions: [],
    status: 'rejected',
    statusNote: 'We couldn’t verify that this company sponsors student programs.',
    members: [{ email: 'member-quickcash@pitfund.test', name: 'Rick Dawson', jobTitle: 'CEO' }],
  },
]

export const PITCHES: Array<[number, string, PitchStatus]> = [
  [31579, 'Brightline Engineering', 'matched'],
  [31579, 'Cedar Valley Credit Union', 'sent'],
  [31579, 'Meridian Machine Works', 'in_review'],
  [31579, 'Northpeak Software', 'changes_requested'],
  [31579, 'Harbor Point Energy', 'rejected'],
  [31579, 'Ridgeway Aerospace', 'declined'],
  [31579, 'Summit Fabrication', 'draft'],
  [31579, 'Lakeshore Medical Devices', 'withdrawn'],
  [24890, 'Brightline Engineering', 'sent'],
  [24890, 'Cedar Valley Credit Union', 'in_review'],
  [24890, 'Northpeak Software', 'draft'],
  [24890, 'Summit Fabrication', 'matched'],
  [16072, 'Brightline Engineering', 'declined'],
  [16072, 'Cedar Valley Credit Union', 'matched'],
  [16072, 'Meridian Machine Works', 'sent'],
  [20443, 'Brightline Engineering', 'in_review'],
  [20443, 'Harbor Point Energy', 'sent'],
  [20443, 'Ridgeway Aerospace', 'changes_requested'],
  [18215, 'Brightline Engineering', 'sent'],
  [18215, 'Lakeshore Medical Devices', 'in_review'],
  [18215, 'Summit Fabrication', 'rejected'],
  [22761, 'Cedar Valley Credit Union', 'declined'],
  [22761, 'Northpeak Software', 'matched'],
  [22761, 'Meridian Machine Works', 'withdrawn'],
  [14398, 'Brightline Engineering', 'draft'],
  [14398, 'Harbor Point Energy', 'in_review'],
  [25530, 'Cedar Valley Credit Union', 'sent'],
  [25530, 'Ridgeway Aerospace', 'sent'],
  [19904, 'Brightline Engineering', 'changes_requested'],
  [27112, 'Lakeshore Medical Devices', 'matched'],
]

/** Plausible answers, picked by question id (or by position for defaults). */
export function answerFor(questionId: string, team: TeamFixture, company: string, index: number): string {
  const byId: Record<string, string> = {
    'default-why': `${company} supports robotics in ${team.state}, and several of our students want to work in exactly the kind of engineering you do. We would love to show you what they build.`,
    'default-impact': `Your support would cover our state championship registration and a spare control hub, so one hardware failure doesn't end our season. It also lets us keep the team free for every student.`,
    'default-connection': index % 2 === 0 ? `One of our mentors' parents has worked with ${company} for years, and we compete about twenty minutes from your office.` : '',
    'bl-process': `Our intake jammed on the second ring every match. We tried a wider funnel, then compliant wheels, and ended up with a two-stage roller that cut our cycle time from 9 to 6 seconds. The notebook has every version.`,
    'bl-reach': `We run a free workshop at the public library every month and demo at elementary STEM nights. Last season that was about 600 students and families.`,
    'bl-budget': `$1,200 for state championship registration, $600 for a spare control hub and motors, and $400 toward travel so no student stays home.`,
    'bl-mentors': `Yes. Our software group would especially value someone who has shipped embedded code.`,
    'mm-parts': `Two drivetrain side plates and a set of intake brackets. CAD is finished and exported as STEP files.`,
    'hp-county': `Hillsborough County.`,
    'hp-students': `Fourteen students, eight of them new this year.`,
    'lm-volunteer': index % 2 === 0 ? `Not yet, but a parent on our team works in your Cambridge office and has offered to help.` : '',
  }
  return byId[questionId] ?? `We are ${team.name}, team ${team.number} from ${team.city}. This season we are focused on building a reliable robot and growing our outreach.`
}

export const REVIEW_NOTES = {
  changes_requested:
    'Thanks for this. Please say what the funding would pay for in the second answer. Companies respond much better to specific amounts and items.',
  rejected: 'This pitch reads as a generic template and doesn’t answer the company’s questions. You’re welcome to pitch other companies.',
}

export const DECLINE_REASONS = ['Outside our region this season', 'Our budget for this season is already committed']
