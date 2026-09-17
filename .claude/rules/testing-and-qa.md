# Testing and QA (plan §10)

Anish does not click through the app. Agents verify everything with these commands.

## Unit and integration — `npm run test` (part of `npm run check`)
- `tests/unit/*.test.ts`, Vitest, against the local Postgres. Wrap DB tests in `dbTest(async () => …)`
  (`tests/unit/helpers/db.ts`): each runs in a transaction that is rolled back. Build fixtures with
  `createUser/createTeam/createSponsor/buildPersonas` (random identifiers, safe in parallel).
- Inject time and transports instead of mocking globals: `drainOutbox({ now, transport })`, `lookupFtcTeam(n, { fetch, now })`.
- Must stay covered: authz matrix, season rule, outbox quota/priority/backoff/idempotency/bounce, Result mapping,
  FTC record fallback, and every new state transition (legal and illegal).

## E2E — `npm run e2e`
- `tests/e2e`, serial. Starts `npm run dev` (:3000, the Send Email hook target) and a production build (:3100).
- Global setup seeds `demo` and saves persona sessions via `/api/dev/sign-in` into `tests/.auth/`.
  Use `test.use(asPersona('coach'))`. Only the login tests drive the login UI; they read codes from Mailpit
  (`tests/support/mailpit.ts`).
- Tests that change shared state restore it (see the join-request test) or reseed.
- Assert `problems` (console errors, page errors, failed requests) is empty on journeys.
- Never gate a test on an unrelated env var; a skip reads as a pass.
- Seeded rows have deterministic ids: import `SEED`, `seedPitchId(...)` and `SEED_INVITE_TOKENS` from
  `scripts/seed/ids.ts` instead of querying. Upload fixtures (valid ~2 MB, 8-page, corrupt, not-a-pdf) are
  written to `tests/.fixtures/` by every seed.
- Inject failures in dev with the `pitfund-simulate` cookie (`ftc-timeout`, `ftc-not-found`, `save-draft`,
  `submit-pitch`; see `lib/server/dev.ts`) and storage failures with `page.route(...)`.
- Wait for hydration (`waitUntil: 'networkidle'`) before `setInputFiles`; an early change event is lost.

## QA gate — `npm run qa`
- Sweeps `tests/qa/routes.ts` (add every new route there) × personas × 375/768/1280 on `demo`, then `edge`, then `empty`
  (routes that open a seeded pitch or invite, and dev routes, are skipped in `empty`).
- Checks: HTTP status, redirects, console/network/exceptions, horizontal scroll, text overflowing its box
  (measured on text runs), axe serious/critical after animations settle, every dialog/sheet/popover
  (width ≥320 px at desktop, fits viewport, sticky close, focus trap, Esc, focus return), TTFB/LCP/CLS
  budgets on the production build, ActionButton pending ≤100 ms on `/dev/ui`.
- States reachable only by interaction (a lookup result, a tab, an upload stage) go in the route's
  `interactions`; each gets its own screenshot `{persona}-{width}[-edge]--{name}.png`.
- Output: `qa/screens/{route}/{persona}-{width}[-edge|-empty].png`, `qa/results/*.json`, `qa/report.md`.
- **Green is not done.** Open the screenshots and judge them against `.claude/rules/ux-contract.md`.
  Crop long pages with a Playwright element screenshot when a full-page image is too tall to read.

## More gates
- `npm run qa:clicks` (`tests/qa/dead-clicks.ts`): every visible button on every production route must change the DOM,
  navigate, call an action, open a chooser or a dialog within 150 ms; every link must go somewhere. Reseeds `demo`.
- `npm run perf` (`scripts/perf.ts`): first-load JS ≤170 KB per QA route (scripts in the HTML), Lighthouse mobile with applied Slow 4G throttling (perf ≥90, a11y ≥95,
  LCP ≤2 s, CLS ≤0.05), ≤5 queries and render p95 ≤400 ms on the authed list/review pages (a second server with
  `DEBUG_QUERIES=1` on :3101), autosave action p95 ≤500 ms. Budgets live in `BUDGETS` (`tests/qa/routes.ts`).
- `npm run security:scan`: no secret from `.env.local` in browser-reachable build output, anon REST reads/writes nothing,
  `/dev/*` unreachable in production, no non-goal leftovers (allowlist for lines that deny a concept).
- `npm run email:preview`: every template (plus long-content variants) through Mailpit: HTML + text parts, sender,
  absolute links, URLs on their own lines, no overflow at 600/375 px; screenshots in `qa/emails/`.
- `tests/unit/authz-coverage.test.ts`: every server action and route handler calls a guard first or is on the public
  allowlist with its replacement check. `tests/e2e/acceptance.spec.ts`: the plan §12 screen counts, times and clicks.
- `tests/e2e/keyboard-journeys.spec.ts`: sign-in, composer and company response with Tab/Enter/Space/arrows/Esc only
  (focus trap and focus return in every dialog). `tests/e2e/mobile.spec.ts`: taps at 375 px on the production build; every
  control used must be ≥ 32 px tall, on screen and not covered where a finger lands.
- **Signing up no longer lands in the app.** A new team or company is a `draft` on its setup page and reaches the
  workspace only once an admin approves it, so any test that signs up and then does something has to either go through
  the admin UI (`tests/e2e/acceptance.spec.ts`) or approve directly (`update teams set status = 'approved'`) when the
  review isn't what it's testing. Personas `coach-pending` and `sponsor-pending` sit in that waiting state.
- Workspace pages export `instant = false`: their guards redirect an org that isn't approved, and a redirect can't be
  validated as instant. Without it every such page logs a console error, which the QA gate counts as a failure.
- A simulation cookie must be added with `path: '/'`. Deriving the path from `page.url()` silently scopes it to whatever
  directory the page was in, so it stops being sent after the next navigation.
- Running a second checkout's `npm run setup` restarts the shared local Supabase stack with that checkout's hook secret, so
  auth emails fail here ("signInWithOtp failed 500"). Re-run `npm run setup` in this checkout to take it back.
- `npm run screenshots:marketing` regenerates `public/marketing/*.webp` from the seeded production build.

## CI — `.github/workflows/ci.yml`
One job, Node 24, on every PR and push to `main`/`rebuild`: typecheck · lint → `npm run setup` (local Supabase,
migrate, seed `demo`, writes `.env.local`) → Vitest → build → E2E → `npm run qa` (every scenario project) →
`npm run perf` → `npm run knip`. After a green build, E2E/QA/perf/knip each run even if an earlier one failed.
Caches: npm, `~/.cache/ms-playwright` (keyed by the `@playwright/test` version), `.next/cache`.
Artifacts: `qa-report` (`qa/report.*`, `qa/results`, `qa/perf`) always; `qa-screens` only when QA fails;
`playwright-report` + `test-results` on any failure. No secrets: everything runs on the runner's local stack.
