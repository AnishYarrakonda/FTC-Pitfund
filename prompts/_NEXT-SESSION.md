# Next session

**Updated 2026-09-13. Rebuild in progress on branch `rebuild`. Prompt 1 (foundation) is done.**
**Run `prompts/rebuild/02-team-experience.md` next**, in a fresh session. The plan is
`prompts/rebuild/00-REBUILD-PLAN.md`; `CLAUDE.md` and `.claude/rules/*` describe v2.
Team email: **ftcexodius@gmail.com**.

## What exists

- v1 deleted from `rebuild` (tag `legacy-v1` pushed). `main` still holds v1 until prompt 4 merges.
- Stack, schema (all of plan §4, RLS on + zero policies + API roles revoked), migrations in `drizzle/`.
- `npm run setup` (Docker is the only prerequisite; verified from a fresh clone with the stack wiped).
- Seeds `demo` / `empty` / `edge`, nine personas, real PDFs and logos in local storage.
- Auth: email code end to end (Supabase → Send Email hook → outbox → Mailpit), Google wired
  (button explains it is unavailable until `GOOGLE_CLIENT_ID/SECRET` exist), `/auth/callback`, sign out.
- `getViewer()` one-query viewer; `authz.ts` guards with a guard × persona test matrix.
- Email outbox with quota budgets, deferral, backoff, idempotency, bounce webhook; tests with a fake clock.
- Design system (`components/ui`), app shell (top bar, role-aware nav, bell, account menu, mobile sheet),
  `/welcome` (role choice, 18+, terms, join-request waiting screen), `/account` (edit, sign out, delete with
  last-member block), admin area, error/404 pages, first-version landing and legal pages.
- `/dev` (persona switcher, reset data, links) and `/dev/ui` (every component and state).
- `npm run check`, `npm run e2e` (35 tests), `npm run qa` (162 route × persona × width checks on demo and
  edge), CI workflow. All green at hand-off.

## Placeholders that prompts 2–3 replace

`/pitches`, `/sponsors`, `/team` (prompt 2), `/inbox`, `/company`, `/admin`, `/admin/directory`,
`/admin/system` (prompt 3) render honest "opens soon" states. `/welcome/team` and `/welcome/company` are the
hand-off pages for team setup (prompt 2) and company setup (prompt 3); `completeWelcome` routes there.
Notifications in the seed link to `/pitches/[id]`, `/inbox/[id]`, `/admin/pitches/[id]`, which don't exist
yet (links use `prefetch={false}`). Add every new route to `tests/qa/routes.ts`.

## Things the next agent must know

- **Cache Components is on.** Runtime data (`cookies`, DB) must sit under Suspense (`loading.tsx` works).
  The `(app)` and `admin` layouts set `export const instant = false` because they redirect signed-out users.
  Route handlers touching the DB call `connection()`. Hidden routes stay mounted (React Activity): going
  back to a form keeps its state — tests must not assume a reset.
- In **production**, primary nav links are fully prefetched (navigation is instant; no skeleton). In
  `next dev` there is no prefetch. Test loading skeletons against the production server (`:3100`).
- **`server-only` throws outside Next.** Scripts run with `--import ./scripts/lib/server-only-stub.mjs`
  (package.json does this); Vitest aliases it; drizzle-kit runs with the stub via `NODE_OPTIONS`.
- **Action shape:** `defineAction` → guard → `inTransaction(data + audit + notify + enqueueEmail)` →
  `after(drainOutbox)` → revalidate → Result. `lib/server/transaction.ts` exists so actions never import the DB.
- **Supabase says `otp_expired` for wrong and expired codes alike**; the login page decides by time since
  sending. Local `max_frequency` is 5 s (the page's resend countdown is 30 s). A browser fake clock does not
  move Supabase's clock; E2E waits real seconds where that matters.
- **Local email:** SMTP to Mailpit on `127.0.0.1:54325`, UI on `:54324`. The Send Email hook calls
  `host.docker.internal:3000`, so login emails only work with the dev server on port 3000.
- Auth sign-in codes are sent synchronously and **fail instead of deferring** when the quota is gone (a late
  code is useless); their payload is scrubbed from the outbox after sending.
- `/api/dev/sign-in` and `/dev/*` are prerendered as 404 in production builds (E2E asserts it).
- QA signs personas in without the UI by minting a magic-link token with the local secret key
  (`tests/support/session.ts`); E2E uses `/api/dev/sign-in`. Cookies are per host, not per port, so both
  servers share sessions.
- Supabase CLI is a devDependency (2.117). Its config section is `[local_smtp]` (was `[inbucket]`). `setup`
  restarts the stack if the running auth container has a different hook secret (another checkout started it).
- The overflow check in QA measures text runs, not `scrollWidth`; a `pre-wrap` hanging space is ignored.
  If QA flags overflow, it is real: add `min-w-0` to the grid/flex child (Tabs got this; see `components/ui/tabs.tsx`).
- Seeded logos and thumbnails are PNG (the plan says WebP for uploads; prompt 2's upload path produces WebP).

## Deviations from the prompt, with reasons

- CI order is typecheck · lint → setup → Vitest → build → E2E: the "check" tests are integration tests that
  need the local database, so the stack starts before them.
- `Result` types live in `lib/shared/result.ts` (client needs them); `lib/server/result.ts` re-exports and adds
  `defineAction`/`mapDbError`. The service-role client is `lib/server/supabase-admin.ts` so the lint rule can
  ban it without banning the cookie client that auth routes need.
- Performance budgets are measured locally against `next start` (TTFB 2–40 ms, LCP ≤ 380 ms, CLS 0), not on
  Vercel/Lighthouse; prompt 4 runs Lighthouse against the deployment.
- Knip reports unused exports that are foundation APIs for prompts 2–3 (`storage.ts` upload helpers, question
  limits, `react-hook-form`). Prompt 4 makes knip clean.

## Known gaps

- Sentry has no DSN yet (reporting code is wired; `reportUnexpected` falls back to a local reference id).
- BotID only verifies on Vercel; locally `checkBotId()` passes.
- CI has not run on GitHub yet at the time of writing this; check the first run of `rebuild` (Linux
  `host.docker.internal` for the auth hook is the likeliest difference from macOS).
- `npm audit`: 4 moderate advisories in dev-only tooling (esbuild inside drizzle-kit); the fix is a breaking
  downgrade.

## Local v1 leftovers

Untracked v1 files that git could not restore (the v1 `.env.local` with **production** Clerk/Supabase/Resend
secrets, gitignored QA reports, audit findings) were moved, not deleted, to
`../_v1-local-archive-2026-09-13/` next to the repo. Delete it once the v1 services are decommissioned.
