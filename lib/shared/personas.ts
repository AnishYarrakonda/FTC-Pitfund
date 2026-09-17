/*
 * Local development personas (plan §10). Created by `npm run seed`, signed in by one click
 * on /dev, and used by the Playwright fixtures. Never exist outside the local stack.
 */

export const PERSONAS = [
  { key: 'admin', name: 'Avery Admin', description: 'FTC Pitfund admin, no team or company', home: '/admin' },
  { key: 'coach-new', name: 'Noah Newcoach', description: 'Signed in, no team yet', home: '/welcome' },
  { key: 'coach', name: 'Maya Chen', description: 'Verified team with pitches in every state', home: '/pitches' },
  { key: 'coach2', name: 'Jordan Reyes', description: 'A second approved team (isolation)', home: '/pitches' },
  { key: 'coach-pending', name: 'Ellis Vance', description: 'Team waiting for review', home: '/welcome/pending' },
  { key: 'coach-joiner', name: 'Sam Patel', description: 'Asked to join a team, waiting', home: '/welcome' },
  { key: 'sponsor-new', name: 'Riley Newco', description: 'Signed in, no company yet', home: '/welcome' },
  { key: 'sponsor-pending', name: 'Priya Shah', description: 'Company waiting for review', home: '/welcome/pending' },
  { key: 'sponsor', name: 'Daniel Brooks', description: 'Approved company with an inbox', home: '/inbox' },
  { key: 'sponsor2', name: 'Elena Garcia', description: 'A second approved company (isolation)', home: '/inbox' },
] as const

export type PersonaKey = (typeof PERSONAS)[number]['key']

export const PERSONA_DOMAIN = 'pitfund.test'

export function personaEmail(key: PersonaKey) {
  return `${key}@${PERSONA_DOMAIN}`
}

export function isPersonaKey(value: string): value is PersonaKey {
  return PERSONAS.some((p) => p.key === value)
}
