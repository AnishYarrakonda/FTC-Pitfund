# Next session

**Updated 2026-09-14. Rebuild in progress on branch `rebuild`. Prompts 1 (foundation) and 2 (team /
coach experience) are done.** **Run `prompts/rebuild/03-sponsor-and-admin.md` next**, in a fresh session. The plan is
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
- `npm run check` (86 unit/integration tests), `npm run e2e` (49 journeys), `npm run qa` (312 route ×
  persona × width checks on demo and edge), CI workflow. All green at hand-off.

## Prompt 2: what the coach side has

- `/welcome/team`: debounced FIRST lookup (checking / found / not found / unavailable / already on FTC Pitfund
  → Request to join), 18+ and Terms, create team → `/pitches`.
- `/team`: profile with unsaved-changes guard, 512 px WebP logo, PDF deck upload (consent, XHR progress,
  Cancel, Uploading → Checking your PDF… → Creating preview… → Done, Retry), public-page preview card,
  members (invite / resend / revoke / remove / leave; last member can't leave), join requests (approve/decline).
- `/t/[number]`: cached public page, canvas PdfViewer, `generateMetadata`, Report dialog (BotID) → `reports`
  + admin notifications, 404 page for missing/suspended teams (soft 404 in production), no personal data.
- `/sponsors` (approved only; search, support-type chips, cursor pages of 25, per-team status overlay),
  `/sponsors/[id]` ("You'll be asked"), composer `/sponsors/[id]/pitch` (autosave + sessionStorage backup,
  ask, preview via `PitchView`, readiness blockers, submit confirm, "updated its questions" and review-note
  banners, delete draft), `/pitches` (setup checklist + groups), `/pitches/[id]` (timeline with email
  delivery notes, actions, Connected panel, withdraw).
- `/invite/[token]` (file: `app/(public)/invite/[token]/`, not `app/invite`): generic for `team | sponsor`.
- Emails: `team-invite` (sensitive, token scrubbed after send), `join-request`, `join-decision`,
  `admin-new-pitch` (priority 2), `pitch-withdrawn` (priority 1). All rendered and checked in Mailpit.

Still placeholders for prompt 3: `/inbox`, `/company`, `/admin`, `/admin/directory`, `/admin/system`,
`/welcome/company`. Seed notifications link to `/inbox/[id]` and `/admin/pitches/[id]`, which don't exist yet.

## For prompt 3 (reuse these, don't fork them)

- **`components/pitch/pitch-view.tsx`** — `PitchView({ pitch: PitchViewData, deck?: 'card' | 'none',
  headerAside?, headingLevel? })`, no hooks. Build `PitchViewData` with `teamForView()` from
  `lib/server/data/pitches.ts`.
- **Invites** — `lib/server/data/invites.ts` (`createInvite/resendInvite/revokeInvite/listOpenInvites/
  getInviteByToken/acceptInvite`, `inviteOrgFor(viewer, 'sponsor')`). `acceptInvite` already handles
  `kind = 'sponsor'` (blocks rejected/suspended companies; home `/inbox`). Only a `sponsor-invite` email
  template and the company members UI are missing. Copy the members section in `app/(app)/(workspace)/team/`.
- **`notifyAdminsOfReport(report)`** in `lib/server/data/reports.ts` — in-app only; add the `admin-report`
  email there (it runs inside the report's transaction).
- **Pitch email convention** — dedupe key `pitch:{pitchId}:{template}:{recipient}[:{suffix}]`
  (`pitchEmailKey()`). The coach timeline reads outbox rows by that prefix: it explains delayed/failed
  delivery for template `new-pitch-sponsor` on the "Approved and sent" event and `pitch-withdrawn`. Use
  exactly `new-pitch-sponsor` for the email to company members on approval.
- **Cache tags** — `lib/server/cache-tags.ts` `TAGS`: `teams`, `team(id)`, `teamNumber(n)` (public team page),
  `sponsors`, `sponsor(id)` (directory + company profile). Admin approve/reject/suspend of a company must
  `updateTag(TAGS.sponsors)` + `TAGS.sponsor(id)`; verifying or suspending a team must update `TAGS.team(id)`
  and `TAGS.teamNumber(n)`. `POST /api/revalidate` (Bearer `CRON_SECRET`) expires `teams` + `sponsors` for
  changes made outside the app; `npm run seed` calls it on :3000 and :3100.
- **Uploads** — `lib/server/uploads.ts` (verify bytes, staging paths, publish, receipts) and
  `components/uploads/logo-upload.tsx` (props `createUpload`, `finalize`) work for company logos as-is.
- **Failure injection (dev only)** — cookie `pitfund-simulate` = comma list of `ftc-timeout`,
  `ftc-not-found`, `save-draft`, `submit-pitch`; checked with `simulated(key)` (`lib/server/dev.ts`).
- **Seed ids are deterministic** — `scripts/seed/ids.ts` (`SEED`, `seedTeamId/seedSponsorId/seedPitchId`,
  `SEED_INVITE_TOKENS`). Tests and `tests/qa/routes.ts` import it; add new named rows there.
- **Seed contents added** — Keystone Robotics Foundation (approved, 10 questions, no pitches), Summit
  Fabrication changed its questions after Exodius's draft, drafts are half-filled, Tidal Robotics has no
  logo/deck and an unchecked record, a FIRST record for 23014 (not on FTC Pitfund), invites with known tokens
  (valid for coach-new, expired, revoked, used, a company invite). `edge` adds 24 approved companies (two
  directory pages). Every seed writes PDF fixtures to `tests/.fixtures/` (gitignored): 3-page ~2 MB,
  8-page, corrupt, not-a-pdf.
- **QA interactions** — `QaRoute.interactions` runs a state reachable only by interaction on a fresh load
  and screenshots it as `{persona}-{width}--{name}.png` (lookup results, composer Preview tab, upload
  progress/interrupted). Dialog triggers (`aria-haspopup="dialog"`) are opened automatically.
- **Measured (local production build)** — `/t/31579` TTFB 2 ms, LCP 44 ms, CLS 0; every coach route TTFB
  ≤ 8 ms, LCP ≤ 344 ms. Slow 3G (400 ms RTT, 500 kbit): primary nav is instant (prefetched), detail pages
  show their skeleton within ~340 ms, buttons acknowledge at once, no console errors.
- **Query counts** — `DEBUG_QUERIES=1 npm run dev` logs every query. Measured: `/pitches` 3, `/sponsors` 3
  (4 when the directory cache is cold), `/team` 5, including the viewer query.

## Things the next agent must know

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
- **Status codes and `notFound()`.** Under a Suspense boundary (a `loading.tsx` counts) the response has
  already streamed as 200, so workspace pages render the 404 UI with status 200. In a production build every
  dynamic route streams its static shell first, so even `/t/[number]` (no `loading.tsx`, `instant = false`)
  is a **soft 404 in production** (200 + 404 UI + `noindex`) and a real 404 only in `next dev`. A real
  production 404 would need a DB lookup in `proxy.ts` (Next's documented route), which the plan keeps
  session-only. E2E asserts both behaviors. The root layout sets no default `robots` tag, so the injected
  `noindex` never competes with `index, follow`.
- **Tag expiry has one-second resolution.** An entry cached in the same second as `revalidateTag(tag,
  { expire: 0 })` can survive it; tests wait 1 s after warming a page before expiring.
- **pdf.js 6:** `PDFDocumentProxy` has no `destroy()`; `openPdf()` in `lib/client/pdf.ts` returns a document
  whose `destroy` calls the loading task's.
- **Supabase Storage bucket named `public`:** `storage.from('public').download()` hits the public-object route
  and fails ("Bucket not found"); read public objects over HTTP (`publicUrl()`). Overwriting a signed upload
  path is a 409; cross-bucket `move` works; staging refuses `text/html`.
- Running `npm run build` while `npm run dev` is up rewrites `.next` and can reload the dev server mid-test;
  one E2E run failed that way (a blank page) and passed on rerun. Don't build during an E2E run.
- E2E that uses a file input waits for hydration (`waitUntil: 'networkidle'`) — an early `setInputFiles`
  is silently lost.

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

### Prompt 2

- **Deck upload is two server steps with a signed receipt** (`checkDeck` → `saveDeck`) instead of one
  `finalizeDeck`, so "Checking your PDF…" and "Creating preview…" are honest stages. `checkDeck` verifies the
  staged bytes (magic, size, pdf-lib pages), writes its own copy (`verified-{uuid}.pdf`, which the browser
  can't overwrite) and returns an HMAC receipt (signed with `SUPABASE_SECRET_KEY`, 30 min, team-scoped);
  `saveDeck` accepts only that receipt, publishes, updates the team and deletes old objects after commit.
- `/t/[number]` is a soft 404 in production builds (see the status-code note above), not a real 404.
- Added `POST /api/revalidate` (not in the plan) so reseeds and out-of-band data fixes never show stale
  cached pages.
- The setup checklist treats the logo as required for the checklist to disappear (deck, summary, logo;
  invite optional), matching the prompt's list.
- QA doesn't cover the "not found in FIRST records" lookup: in a production build it would call FTCScout
  over the network. E2E covers the unavailable path (simulate cookie) and unit tests cover not-found.

## Known gaps

- **First-load JS is over the plan §6 budget (170 KB gzipped).** Measured by gzipping the chunks each page's
  HTML loads (the `noModule` polyfill excluded): `/` 199 KB, `/t/31579` 223 KB, `/pitches` 213 KB, `/login`
  275 KB. Prompt 2 moved the Sentry browser SDK to a lazy import (`lib/client/sentry.ts`, −55 KB on every
  route). The rest is shared: React DOM + Next runtime (~110 KB), Radix primitives mounted by the shell
  (menus, dialog, tooltip, toaster ~60 KB), lucide icons (~20 KB), BotID. `/t/[number]` adds ~24 KB for the
  report dialog and select. Prompt 4 owns meeting the budget (candidates: lazy report dialog, lighter
  shell menus, `optimizePackageImports`).

- Sentry has no DSN yet (reporting code is wired; `reportUnexpected` falls back to a local reference id).
- BotID only verifies on Vercel; locally `checkBotId()` passes.
- CI is green on GitHub (typecheck, lint, local Supabase, Vitest, build, E2E on Linux). Two things broke
  the first runs and are fixed: `typecheck` must run `next typegen` first (route types are gitignored), and a
  macOS-generated lockfile can miss Linux native bindings (npm/cli#4828) — if you ever regenerate
  `package-lock.json`, delete `node_modules` and the lockfile first, then check it lists
  `@rolldown/binding-linux-x64-gnu`.
- `npm audit`: 4 moderate advisories in dev-only tooling (esbuild inside drizzle-kit); the fix is a breaking
  downgrade.

## Local v1 leftovers

Untracked v1 files that git could not restore (the v1 `.env.local` with **production** Clerk/Supabase/Resend
secrets, gitignored QA reports, audit findings) were moved, not deleted, to
`../_v1-local-archive-2026-09-13/` next to the repo. Delete it once the v1 services are decommissioned.
