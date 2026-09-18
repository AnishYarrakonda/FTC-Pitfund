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

type QaPersona = PersonaKey | 'anonymous'

export type QaRoute = {
  name: string
  path: string
  personas: QaPersona[]
  server?: 'prod' | 'dev'
  budget?: 'public' | 'authed'
  expectStatus?: number
  /** The route deliberately renders the 404 page. */
  expectNotFound?: boolean
  actionButtons?: boolean
  interactions?: QaInteraction[]
}

type QaInteraction = {
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

const notAFitOther: QaInteraction = {
  name: 'not-a-fit-other',
  run: async (page) => {
    await page.getByRole('button', { name: 'Not a fit' }).click()
    const dialog = page.getByRole('dialog', { name: 'Mark this pitch not a fit?' })
    await dialog.getByRole('radio', { name: 'Other' }).click()
    await expect(dialog.getByLabel('Tell the team why')).toBeVisible()
  },
}

const customizeQuestions: QaInteraction = {
  name: 'questions-editing',
  run: async (page) => {
    const section = page.locator('#questions')
    const customize = section.getByRole('button', { name: 'Customize' })
    if (await customize.isVisible()) await customize.click()
    await expect(section.getByRole('button', { name: 'Add question' })).toBeVisible()
    await section.getByRole('button', { name: /Move question 1 down/ }).click()
    await expect(section.getByText('Unsaved changes')).toBeVisible()
  },
}

const directorySearchEmpty: QaInteraction = {
  name: 'search-empty',
  run: async (page) => {
    await page.getByLabel('Search teams by name or number').fill('zzz no such team')
    await expect(page.getByText(/No teams match/)).toBeVisible({ timeout: 10_000 })
  },
}

const personActionDialog: QaInteraction = {
  name: 'person-action',
  widths: [375, 1280],
  run: async (page) => {
    await page.getByRole('button', { name: /^Actions for / }).first().click()
    await page.getByRole('menuitem').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
  },
}

/*
 * The logo cropper opens on a file pick rather than from an [aria-haspopup="dialog"] trigger, so the
 * gate's automatic dialog sweep never reaches it. Open it by hand to get it screenshotted and axed.
 */
const cropLogo: QaInteraction = {
  name: 'logo-cropper',
  run: async (page) => {
    await page.getByRole('button', { name: 'Logo image' }).setInputFiles('tests/.fixtures/logo.png')
    const dialog = page.getByRole('dialog', { name: 'Position your logo' })
    await expect(dialog.getByRole('button', { name: 'Use photo' })).toBeVisible({ timeout: 20_000 })
    await dialog.getByLabel('Zoom').fill('2')
  },
}

const openFaq: QaInteraction = {
  name: 'faq-open',
  run: async (page) => {
    await page.getByText('What gets shared and when?').click()
    await expect(page.getByText(/Names, emails and phone numbers are shared only when/)).toBeVisible()
  },
}

export const QA_ROUTES: QaRoute[] = [
  // Public
  // coach: the landing top bar offers "Open FTC Pitfund" when a session cookie exists.
  { name: 'landing', path: '/', personas: ['anonymous', 'coach'], budget: 'public', interactions: [openFaq] },
  { name: 'login', path: '/login', personas: ['anonymous'], budget: 'public' },
  { name: 'login-team', path: '/login?intent=team', personas: ['anonymous'], budget: 'public' },
  { name: 'login-company', path: '/login?intent=company', personas: ['anonymous'], budget: 'public' },
  { name: 'legal-terms', path: '/legal/terms', personas: ['anonymous'], budget: 'public' },
  { name: 'legal-privacy', path: '/legal/privacy', personas: ['anonymous'], budget: 'public' },
  { name: 'not-found', path: '/this-page-does-not-exist', personas: ['anonymous'], expectStatus: 404, expectNotFound: true, budget: 'public' },
  { name: 'public-team', path: '/t/31579', personas: ['anonymous', 'coach'], budget: 'public' },
  { name: 'public-team-no-deck', path: `/t/${SEED.tidal.number}`, personas: ['anonymous'], budget: 'public' },
  // A soft 404 in production builds (status 200, 404 UI, noindex); see app/(public)/t/[number]/page.tsx.
  { name: 'public-team-missing', path: '/t/99999', personas: ['anonymous'], expectNotFound: true, budget: 'public' },
  { name: 'invite-valid', path: `/invite/${SEED_INVITE_TOKENS.valid}`, personas: ['anonymous', 'coach-new', 'coach'], budget: 'public' },
  { name: 'invite-company', path: `/invite/${SEED_INVITE_TOKENS.sponsorValid}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-expired', path: `/invite/${SEED_INVITE_TOKENS.expired}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-revoked', path: `/invite/${SEED_INVITE_TOKENS.revoked}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-used', path: `/invite/${SEED_INVITE_TOKENS.used}`, personas: ['anonymous'], budget: 'public' },
  { name: 'invite-invalid', path: '/invite/not-a-real-token', personas: ['anonymous'], budget: 'public' },

  // First run
  { name: 'welcome', path: '/welcome', personas: ['coach-new', 'coach-joiner', 'sponsor-new'], budget: 'authed' },
  { name: 'welcome-intent-team', path: '/welcome?intent=team', personas: ['coach-new'], budget: 'authed' },
  { name: 'welcome-intent-company', path: '/welcome?intent=company', personas: ['sponsor-new'], budget: 'authed' },
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
  // The review gate: a team and a company that have sent themselves in and are waiting.
  { name: 'welcome-pending', path: '/welcome/pending', personas: ['coach-pending', 'sponsor-pending'], budget: 'authed' },
  { name: 'welcome-team-setup', path: '/welcome/team', personas: ['coach-pending'], budget: 'authed' },
  { name: 'welcome-company-setup', path: '/welcome/company', personas: ['sponsor-pending'], budget: 'authed' },

  // Team workspace
  { name: 'pitches', path: '/pitches', personas: ['coach', 'coach2'], budget: 'authed' },
  { name: 'pitch-matched', path: `/pitches/${SEED.pitches.exodiusMatched}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-in-review', path: `/pitches/${SEED.pitches.exodiusInReview}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-changes', path: `/pitches/${SEED.pitches.exodiusChanges}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-declined', path: `/pitches/${SEED.pitches.exodiusDeclined}`, personas: ['coach'], budget: 'authed' },
  { name: 'pitch-withdrawn', path: `/pitches/${SEED.pitches.exodiusWithdrawn}`, personas: ['coach'], budget: 'authed' },
  { name: 'sponsors', path: '/sponsors', personas: ['coach', 'coach2'], budget: 'authed', interactions: [searchNoResults] },
  { name: 'sponsor-in-review', path: `/sponsors/${SEED.meridian}`, personas: ['coach'], budget: 'authed' },
  { name: 'sponsor-start', path: `/sponsors/${SEED.keystone}`, personas: ['coach', 'coach2'], budget: 'authed' },
  { name: 'composer-new', path: `/sponsors/${SEED.keystone}/pitch`, personas: ['coach'], budget: 'authed', interactions: [previewTab] },
  { name: 'composer-draft', path: `/sponsors/${SEED.summit}/pitch`, personas: ['coach'], budget: 'authed', interactions: [previewTab] },
  { name: 'composer-resubmit', path: `/sponsors/${SEED.northpeak}/pitch`, personas: ['coach'], budget: 'authed' },
  {
    name: 'team',
    path: '/team',
    personas: ['coach', 'coach2'],
    budget: 'authed',
    interactions: [uploadStage('hold'), uploadStage('fail'), cropLogo],
  },

  // Company workspace
  { name: 'inbox', path: '/inbox', personas: ['sponsor', 'sponsor2'], budget: 'authed' },
  { name: 'inbox-new', path: `/inbox/${SEED.pitches.voltageToBrightlineSent}`, personas: ['sponsor'], budget: 'authed', interactions: [notAFitOther] },
  { name: 'inbox-matched', path: `/inbox/${SEED.pitches.exodiusMatched}`, personas: ['sponsor'], budget: 'authed' },
  { name: 'inbox-declined', path: `/inbox/${SEED.pitches.gearToBrightlineDeclined}`, personas: ['sponsor'], budget: 'authed' },
  { name: 'inbox-withdrawn', path: `/inbox/${SEED.pitches.knightsToBrightlineWithdrawn}`, personas: ['sponsor'], budget: 'authed' },
  { name: 'company', path: '/company', personas: ['sponsor'], budget: 'authed', interactions: [customizeQuestions] },

  // Shared
  { name: 'account', path: '/account', personas: ['coach', 'coach2', 'sponsor', 'admin'], budget: 'authed' },

  // Admin
  { name: 'admin-review', path: '/admin', personas: ['admin'], budget: 'authed' },
  { name: 'admin-review-companies', path: '/admin?tab=companies', personas: ['admin'], budget: 'authed' },
  { name: 'admin-review-teams', path: '/admin?tab=teams', personas: ['admin'], budget: 'authed' },
  { name: 'admin-review-reports', path: '/admin?tab=reports', personas: ['admin'], budget: 'authed' },
  { name: 'admin-pitch', path: `/admin/pitches/${SEED.pitches.lotusToBrightlineInReview}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-pitch-blocked', path: `/admin/pitches/${SEED.pitches.sagesToVantageInReview}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-pitch-decided', path: `/admin/pitches/${SEED.pitches.exodiusMatched}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-company-pending', path: `/admin/companies/${SEED.atlasPending}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-company-rejected', path: `/admin/companies/${SEED.quickcashRejected}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-company-suspended', path: `/admin/companies/${SEED.vantageSuspended}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-team-unverified', path: `/admin/teams/${SEED.tidal.id}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-team-verified', path: `/admin/teams/${SEED.exodius.id}`, personas: ['admin'], budget: 'authed' },
  { name: 'admin-directory', path: '/admin/directory', personas: ['admin'], budget: 'authed', interactions: [directorySearchEmpty] },
  { name: 'admin-directory-companies', path: '/admin/directory?tab=companies', personas: ['admin'], budget: 'authed' },
  { name: 'admin-directory-people', path: '/admin/directory?tab=people', personas: ['admin'], budget: 'authed', interactions: [personActionDialog] },
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
  // npm run perf
  firstLoadJsKb: 170,
  queriesPerPage: 5,
  renderP95Ms: 400,
  actionP95Ms: 500,
  lighthousePerformance: 90,
  lighthouseAccessibility: 95,
}
