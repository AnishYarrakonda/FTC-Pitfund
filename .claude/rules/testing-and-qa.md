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

## QA gate — `npm run qa`
- Sweeps `tests/qa/routes.ts` (add every new route there) × personas × 375/768/1280 on `demo`, then `edge`.
- Checks: HTTP status, redirects, console/network/exceptions, horizontal scroll, text overflowing its box
  (measured on text runs), axe serious/critical after animations settle, every dialog/sheet/popover
  (width ≥320 px at desktop, fits viewport, sticky close, focus trap, Esc, focus return), TTFB/LCP/CLS
  budgets on the production build, ActionButton pending ≤100 ms on `/dev/ui`.
- Output: `qa/screens/{route}/{persona}-{width}[-edge].png`, `qa/results/*.json`, `qa/report.md`.
- **Green is not done.** Open the screenshots and judge them against `.claude/rules/ux-contract.md`.
  Crop long pages with a Playwright element screenshot when a full-page image is too tall to read.

## CI — `.github/workflows/ci.yml`
typecheck · lint → `npm run setup` (local Supabase, migrate, seed) → Vitest → build → E2E.
