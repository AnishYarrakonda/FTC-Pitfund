import { expect, type Page } from '@playwright/test'

import type { PersonaKey } from '../../lib/shared/personas'
import { SEED, SEED_INVITE_TOKENS } from '../../scripts/seed/ids'

/*
 * The QA route registry: the single list `npm run qa` sweeps (plan §10). Every route × every
 * listed persona × 375/768/1280. Prompts 2–4 add their routes here; nothing else needs to change.
 *
 *   server  'prod' (default) runs against the local production build (:3100) — real performance,
 *           no dev overlay. 'dev' is for routes that exist only in development (/dev, /dev/ui).
 *   budget  'public' (TTFB ≤ 300 ms) or 'authed' (server render ≤ 400 ms). Omit for dev routes.
 *   expectStatus  defaults to 200.
 *   actionButtons  click every [data-action-button] and require pending within 100 ms.
 *   interactions  states reachable only by interacting (a tab, a lookup, an upload stage): each runs
 *           on a fresh load and gets its own screenshot `{persona}-{width}--{name}.png` and checks.
 *           Dialogs need no entry: every [aria-haspopup="dialog"] trigger is opened automatically.
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
  interactions?: QaInteraction[]
}

export type QaInteraction = {
  name: string
  widths?: number[]
  run: (page: Page) => Promise<void>
  /** Console/network errors this interaction causes on purpose (e.g. an aborted upload). */
  expectedErrors?: RegExp[]
}

const STORAGE_PUT = '**/storage/v1/object/upload/sign/**'

/** Choose the seeded valid PDF with storage uploads held (`hold`) or failing (`fail`). */
const uploadStage = (mode: 'hold' | 'fail'): QaInteraction => ({
  name: mode === 'hold' ? 'upload-progress' : 'upload-interrupted',
  expectedErrors: mode === 'fail' ? [/ERR_CONNECTION_RESET/] : [],
  run: async (page) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await page.route(STORAGE_PUT, (route) => (mode === 'fail' ? route.abort('connectionreset') : new Promise(() => {})))
    const deck = page.locator('#deck')
    await deck.getByRole('checkbox', { name: /I have permission/ }).click()
    await deck.locator('input[type=file]').setInputFiles('tests/.fixtures/deck-3-pages.pdf')
    await expect(deck.getByText(mode === 'hold' ? /Uploading/ : 'Upload interrupted.')).toBeVisible({ timeout: 20_000 })
  },
})

const lookup = (name: string, number: string, then?: (page: Page) => Promise<void>): QaInteraction => ({
  name,
  run: async (page) => {
    await page.getByLabel('FTC team number').fill(number)
    await expect(page.getByText(new RegExp(`Team ${number} ·`)).first()).toBeVisible({ timeout: 20_000 })
    await then?.(page)
  },
})

const previewTab: QaInteraction = {
  name: 'preview',
  widths: [375, 768],
  run: async (page) => {
    await page.getByRole('radio', { name: 'Preview' }).click()
    await expect(page.getByText(/will see$/)).toBeVisible()
  },
}

const searchNoResults: QaInteraction = {
  name: 'search-empty',
  run: async (page) => {
    await page.getByLabel('Search companies by name').fill('zzz no such company')
    await expect(page).toHaveURL(/q=zzz/, { timeout: 10_000 })
    await expect(page.getByText(/No companies match/)).toBeVisible()
  },
}

export const QA_ROUTES: QaRoute[] = [
  // Public
  { name: 'landing', path: '/', personas: ['anonymous'], budget: 'public' },
  { name: 'login', path: '/login', personas: ['anonymous'], budget: 'public' },
  { name: 'legal-terms', path: '/legal/terms', personas: ['anonymous'], budget: 'public' },
  { name: 'legal-privacy', path: '/legal/privacy', personas: ['anonymous'], budget: 'public' },
  { name: 'not-found', path: '/this-page-does-not-exist', personas: ['anonymous'], expectStatus: 404, budget: 'public' },
  { name: 'public-team', path: '/t/31579', personas: ['anonymous', 'coach'], budget: 'public' },
  { name: 'public-team-no-deck', path: `/t/${SEED.tidal.number}`, personas: ['anonymous'], budget: 'public' },
  // A soft 404 in production builds (status 200, 404 UI, noindex); see app/(public)/t/[number]/page.tsx.
  { name: 'public-team-missing', path: '/t/99999', personas: ['anonymous'], budget: 'public' },
  { name: 'invite-valid', path: `/invite/${SEED_INVITE_TOKENS.valid}`, personas: ['anonymous', 'coach-new', 'coach'], budget: 'public' },
  { name: 'invite-company', path: `/invite/${SEED_INVITE_TOKENS.sponsorValid}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-expired', path: `/invite/${SEED_INVITE_TOKENS.expired}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-revoked', path: `/invite/${SEED_INVITE_TOKENS.revoked}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-used', path: `/invite/${SEED_INVITE_TOKENS.used}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-invalid', path: '/invite/not-a-real-token', personas: ['anonymous'], budget: 'public' },

  // First run
  { name: 'welcome', path: '/welcome', personas: ['coach-new', 'coach-joiner', 'sponsor-new'], budget: 'authed' },
  {
    name: 'welcome-team',
    path: '/welcome/team',
    personas: ['coach-new'],
    budget: 'authed',
    interactions: [
      lookup('on-pitfund', '31579'),
      lookup('found', '23014', async (page) => {
        await page.getByRole('button', { name: 'Yes, that’s my team' }).click()
        await expect(page.getByLabel('Team name')).toHaveValue('Robo Ravens')
      }),
    ],
  },
  { name: 'welcome-company', path: '/welcome/company', personas: ['sponsor-new'], budget: 'authed' },

  // Team workspace
  { name: 'pitches', path: '/pitches', personas: ['coach', 'coach-unverified'], budget: 'authed' },
  { name: 'pitch-matched', path: `/pitches/${SEED.pitches.exodiusMatched}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-in-review', path: `/pitches/${SEED.pitches.exodiusInReview}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-changes', path: `/pitches/${SEED.pitches.exodiusChanges}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-declined', path: `/pitches/${SEED.pitches.exodiusDeclined}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-withdrawn', path: `/pitches/${SEED.pitches.exodiusWithdrawn}`, personas: ['coach'], budget: 'authed' },
  { name: 'sponsors', path: '/sponsors', personas: ['coach', 'coach-unverified'], budget: 'authed', interactions: [searchNoResults] },
  { name: 'sponsor-in-review', path: `/sponsors/${SEED.meridian}`, personas: ['coach'], budget: 'authed' },
  { name: 'sponsor-start', path: `/sponsors/${SEED.keystone}`, personas: ['coach', 'coach-unverified'], budget: 'authed' },
  { name: 'composer-new', path: `/sponsors/${SEED.keystone}/pitch`, personas: ['coach'], budget: 'authed', interactions: [previewTab] },
  { name: 'composer-draft', path: `/sponsors/${SEED.summit}/pitch`, personas: ['coach'], budget: 'authed', interactions: [previewTab] },
  { name: 'composer-resubmit', path: `/sponsors/${SEED.northpeak}/pitch`, personas: ['coach'], budget: 'authed' },
  {
    name: 'team',
    path: '/team',
    personas: ['coach', 'coach-unverified'],
    budget: 'authed',
    interactions: [uploadStage('hold'), uploadStage('fail')],
  },

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
