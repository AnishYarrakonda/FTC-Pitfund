import type { PersonaKey } from '../../lib/shared/personas'

/*
 * The QA route registry: the single list `npm run qa` sweeps (plan §10). Every route × every
 * listed persona × 375/768/1280. Prompts 2–4 add their routes here; nothing else needs to change.
 *
 *   server  'prod' (default) runs against the local production build (:3100) — real performance,
 *           no dev overlay. 'dev' is for routes that exist only in development (/dev, /dev/ui).
 *   budget  'public' (TTFB ≤ 300 ms) or 'authed' (server render ≤ 400 ms). Omit for dev routes.
 *   expectStatus  defaults to 200.
 *   actionButtons  click every [data-action-button] and require pending within 100 ms.
 */

export type QaPersona = PersonaKey | 'anonymous'

export type QaRoute = {
  name: string
  path: string
  personas: QaPersona[]
  server?: 'prod' | 'dev'
  budget?: 'public' | 'authed'
  expectStatus?: number
  actionButtons?: boolean
}

export const QA_ROUTES: QaRoute[] = [
  // Public
  { name: 'landing', path: '/', personas: ['anonymous'], budget: 'public' },
  { name: 'login', path: '/login', personas: ['anonymous'], budget: 'public' },
  { name: 'legal-terms', path: '/legal/terms', personas: ['anonymous'], budget: 'public' },
  { name: 'legal-privacy', path: '/legal/privacy', personas: ['anonymous'], budget: 'public' },
  { name: 'not-found', path: '/this-page-does-not-exist', personas: ['anonymous'], expectStatus: 404, budget: 'public' },

  // First run
  { name: 'welcome', path: '/welcome', personas: ['coach-new', 'coach-joiner', 'sponsor-new'], budget: 'authed' },
  { name: 'welcome-team', path: '/welcome/team', personas: ['coach-new'], budget: 'authed' },
  { name: 'welcome-company', path: '/welcome/company', personas: ['sponsor-new'], budget: 'authed' },

  // Team workspace
  { name: 'pitches', path: '/pitches', personas: ['coach', 'coach-unverified'], budget: 'authed' },
  { name: 'sponsors', path: '/sponsors', personas: ['coach'], budget: 'authed' },
  { name: 'team', path: '/team', personas: ['coach'], budget: 'authed' },

  // Company workspace
  { name: 'inbox', path: '/inbox', personas: ['sponsor', 'sponsor-pending', 'sponsor2'], budget: 'authed' },
  { name: 'company', path: '/company', personas: ['sponsor'], budget: 'authed' },

  // Shared
  { name: 'account', path: '/account', personas: ['coach', 'coach-unverified', 'sponsor', 'admin'], budget: 'authed' },

  // Admin
  { name: 'admin-review', path: '/admin', personas: ['admin'], budget: 'authed' },
  { name: 'admin-directory', path: '/admin/directory', personas: ['admin'], budget: 'authed' },
  { name: 'admin-system', path: '/admin/system', personas: ['admin'], budget: 'authed' },

  // Local development tools
  { name: 'dev', path: '/dev', personas: ['anonymous'], server: 'dev' },
  { name: 'dev-ui', path: '/dev/ui', personas: ['anonymous'], server: 'dev', actionButtons: true },
]

export const QA_WIDTHS = [375, 768, 1280] as const

/** Performance budgets (plan §6), measured locally against the production build. */
export const BUDGETS = {
  ttfbPublicMs: 300,
  ttfbAuthedMs: 400,
  lcpMs: 2000,
  cls: 0.05,
  actionPendingMs: 100,
  minOverlayWidthPx: 320,
}
