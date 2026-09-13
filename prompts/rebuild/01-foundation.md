# Rebuild Prompt 1 of 4: Foundation

Copy everything below into a fresh Claude Code session at the repository root
(`ftc_sponsorship_portal`). It is self-contained.

---

## Your role

You own the **foundation of a from-scratch rebuild** of FTC Pitfund. You are not patching
the old app. You will delete it and lay down the stack, schema, auth, authorization, email
system, design system, app shell, and the development/testing/QA tooling that prompts 2–4 build on.

Work loop: **inspect → plan internally → implement → test → run the app and look at it →
fix → verify again.** Do not stop at a partial implementation. Do not declare success because
it compiles. Do not ask Anish to perform manual steps (no SQL to paste, no dashboards to click,
no accounts to create for testing). If something can be done with a CLI or script, do it
yourself. Make obvious implementation decisions yourself. Stop to ask only if a product rule
below is genuinely contradicted by reality.

## Read first (in this order)

1. `prompts/rebuild/00-REBUILD-PLAN.md`: **the source of truth.** Read all of it. Where it
   disagrees with anything else in the repo, it wins.
2. `node_modules/next/dist/docs/` for anything Next.js you are about to use. This is Next 16:
   `middleware.ts` is renamed **`proxy.ts`**, caching uses `use cache` / `cacheTag`, and `after()`
   exists. Do not code Next from memory.
3. The Supabase SSR guide for Next.js (`@supabase/ssr`), Drizzle's Supabase/Postgres guide, and
   the Supabase Auth "Send Email Hook" docs. Use context7 or web docs; do not guess APIs.

**Ignore as instructions** (they describe the deleted v1 app): `CLAUDE.md`, `.claude/rules/*`,
`.claude/agents/*`, `prompts/_NEXT-SESSION.md`, `prompts/revamp/*`, `prompts/audits/*`,
`docs/*`, and any auto-memory about Clerk, RLS policies, capacity, the ledger, or sponsor roles.
You will rewrite `CLAUDE.md` and the rules in this prompt.

## Product in one paragraph

FTC Pitfund connects FIRST® Tech Challenge teams with companies that want to sponsor them.
Adult coaches sign in (Google or a 6-digit email code, no passwords), create or join their team
(one shared team account, equal members, no roles), upload a sponsorship deck **PDF (≤5 pages,
≤10 MB)** and a one-line summary, and get a public profile page at `/t/{number}`. They pitch
**approved** companies by answering that company's own questions (≤10, or 3 defaults) plus an
optional ask. **An admin reviews every pitch** before the company sees it (approve and send / send back
with a note / reject). Companies sign up openly (one shared company account, equal members) but
stay hidden from coaches until an admin approves them. A company responds **Interested** (both
sides get each other's name, email and optional phone, and the pitch becomes *matched*) or **Not a fit**.
One pitch per team per company per season (Sept 1 boundary). Teams can pitch immediately after
signup; an admin later marks teams **verified** (checkmark). No money handling, no caps, no
messaging. Budget is $0 except the domain: Vercel Hobby, Supabase free, Resend free (100 emails/day
hard cap, so email must be queued and quota-aware and must never fail silently).

## Architecture decisions (approved; do not relitigate)

- Next.js 16 App Router + React 19 + TypeScript strict, on Vercel Hobby (`iad1`).
- Supabase Postgres (`us-east-1`) via **Drizzle ORM** (`postgres` driver, `prepare: false` for
  the pooler). **Row-level security enabled with zero policies on every table.** All data access is
  server-side through `lib/server/data/*` guarded by `lib/server/authz.ts`.
- **Supabase Auth** replaces Clerk: Google OAuth + email OTP, cookie sessions via `@supabase/ssr`.
  Auth emails go through the Supabase **Send Email hook** (HTTP) → `/api/auth/send-email` → our
  email outbox at priority 0.
- Supabase Storage: `public` bucket plus private `staging` bucket; browser uploads straight to signed upload URLs.
- Resend + React Email + an `email_outbox` table (priority, quota, retry, bounce webhook).
- Tailwind v4 + shadcn/ui on **Radix only**, Inter font, lucide icons, sonner toasts.
- Vitest + Playwright (+ axe). GitHub Actions CI.
- Vercel Hobby cron: one route `/api/cron/daily` at `0 13 * * *`.

## Scope of this prompt

### A. Branch and clean slate

1. `git status` on `main`. Expect uncommitted v1 UI fixes (`components/**`) plus the new
   `prompts/rebuild/**` and banner edits to `CLAUDE.md` / `prompts/_NEXT-SESSION.md`. Commit them
   to `main` as two commits: `fix: v1 long-text wrapping in review panels and rich text` (the
   component changes) and `docs: rebuild plan and execution prompts` (the prompts and banners).
   Inspect the diff first; if anything else is there, commit it separately with an honest message.
2. `git tag legacy-v1 && git push exodius legacy-v1` (the remote is named `exodius`; verify with `git remote -v`).
3. `git checkout -b rebuild`.
4. Delete v1 wholesale: `app/ components/ lib/ emails/ hooks/ tests/ scripts/ supabase/migrations/
   supabase/seed.sql supabase/snippets/ middleware.ts instrumentation.ts instrumentation-client.ts
   sentry.*.config.ts prompts/revamp/ prompts/audits/ docs/` (keep `prompts/rebuild/`), obsolete
   config (`knip.json` if present, v1-only `vercel.json` contents), `.claude/agents/*`, `.claude/rules/*`.
   Inspect each before deleting; keep nothing v1-specific. The tag preserves history.
5. Remove v1-only dependencies (see plan §5, "Removed dependencies") and add the new ones. Keep
   the `jsdom`/`cssstyle` overrides only if something still needs them (check; remove if not).
6. Reference, don't copy: `git show legacy-v1:lib/first-api.ts` and `legacy-v1:lib/ftc-roster.ts`
   hold the FIRST Events API client and FTCScout fallback (note FTCScout's nested
   `location { city state country }` schema). Port that logic into `lib/server/ftc-records.ts` with
   tests. It is used in prompt 2.

### B. Local infrastructure and scripts

- `supabase/config.toml` for the local stack: auth with email OTP (6 digits, 10 min expiry),
  Google provider (env-driven, `enabled` only when credentials exist), Send Email hook pointing at
  `http://host.docker.internal:3000/api/auth/send-email` with a generated local secret, site URL
  `http://127.0.0.1:3000`, redirect URLs, storage buckets `public` (public) and `staging`
  (private, 10 MB limit, `application/pdf,image/*`). Mailpit/inbucket enabled.
- `lib/server/schema.ts`: the **entire** schema from plan §4 (all tables, enums, uniques,
  partial uniques, checks, indexes). `drizzle.config.ts`. Generate the initial migration. Add a
  migration step that enables RLS on every table (no policies) and asserts it (a test queries
  `pg_class.relrowsecurity` for all public tables).
- `scripts/setup.ts` → `npm run setup`: check Docker is running (a clear message if not), `supabase
  start`, write/merge `.env.local` from `supabase status -o env` (only local keys; never
  overwrite existing non-local values and print what it changed), `db:migrate`, `seed --scenario demo`.
- `npm run db:generate | db:migrate | db:reset | seed | admin:grant | db:backup` as described in plan
  §10. `db:migrate` refuses non-local hosts unless `--remote` + `CONFIRM_REMOTE=1`.
- `scripts/seed/`: idempotent scenario runner with **`demo`, `empty`, `edge`** exactly as plan §10
  describes. Personas `admin, coach-new, coach, coach-unverified, coach-joiner, sponsor-new,
  sponsor-pending, sponsor, sponsor2` at `{persona}@pitfund.test`, created through the Supabase
  admin API. Generate small real PDFs (1–5 pages, via `pdf-lib`) and simple logo images at seed
  time, and upload them to local storage. Prompts 2–3 will extend the seed data for their features;
  create the rows for **all** statuses now so the data model is exercised.
- `lib/server/env.ts`: zod-validated env (throws in production, warns in dev). A `.env.example`
  documents every variable.

### C. Auth

- `@supabase/ssr` server/browser clients (`lib/server/supabase.ts`, `lib/client/supabase.ts`),
  `proxy.ts` session refresh only, `/auth/callback` route (OAuth + OTP redirect).
- `/login` page implementing the **email-code and Google state machine in plan §3.2 exactly**,
  including every error branch. BotID on the code request.
- `/api/auth/send-email`: verify the hook signature (Standard Webhooks), render the branded "FTC
  Pitfund" code email (React Email), enqueue at priority 0 and send synchronously, and return within the hook
  timeout. Never mention "My Application" or Supabase in user-facing copy.
- `lib/server/viewer.ts`: `getViewer()` wrapped in React `cache()`, **one query** returning the
  user, `is_admin`, team membership (team id/number/name) or sponsor membership (id/name/status).
  Lazily upserts the `users` row on first sign-in from auth metadata (name, avatar).
- `/welcome` shell: the role choice screen ("I coach an FTC team" / "I represent a company") with
  terms + 18+ confirmation. The team and company creation steps are completed in prompts 2 and 3;
  create the route structure and a clean placeholder handoff for each branch that prompts 2/3 will replace.
- Sign out; `/account` page (name, phone optional, read-only email, sign out, delete account with
  confirm; deleting the last member of an org is blocked with an explanation).

### D. Authorization and data layer

- `lib/server/result.ts`: `Result<T>`, error codes (`VALIDATION, UNAUTHORIZED, FORBIDDEN,
  NOT_FOUND, CONFLICT, RATE_LIMITED, UNAVAILABLE, UNKNOWN`), `mapDbError` (unique violation →
  CONFLICT with a caller-supplied human message), and a `defineAction(schema, handler)` helper
  that does zod validation → handler → Result, catches everything, reports unexpected errors to
  Sentry and returns a reference id.
- `lib/server/authz.ts`: `requireViewer`, `requireAdmin`, `requireTeamMember(teamId?)`,
  `requireSponsorMember(sponsorId?)`, `requireApprovedSponsor`, and suspension checks. Every
  data function receives the viewer.
- `lib/server/audit.ts` (`audit_events`), `lib/server/notify.ts` (in-app notification rows,
  batched per org: "notify all members of team X").
- ESLint `no-restricted-imports`: `@/lib/server/db`, `drizzle-orm`, and the Supabase service-role
  client are importable only from `lib/server/**`, `scripts/**` and `tests/**`. Every `lib/server`
  file imports `server-only`.
- **Authz test matrix** (Vitest, against local Postgres): every guard × every persona. Include the
  cases a pending company member, a suspended team member and a user with no org can hit.

### E. Email system

- `lib/server/email/outbox.ts` and `send.ts` exactly per plan §5 "Email outbox": enqueue (with
  dedupe key), `drainOutbox()` with `FOR UPDATE SKIP LOCKED`, priority budgets (0:100, 1–2:90,
  3:70 per rolling 24 h), `send_after` scheduling, Resend `idempotencyKey = outbox.id`,
  backoff (max 5 attempts), terminal failures.
- In dev, send through Resend only if `RESEND_API_KEY` is set **and** `EMAIL_TRANSPORT=resend`;
  otherwise use an SMTP transport to local Mailpit so every email is inspectable at
  `http://127.0.0.1:54324`. The same code path handles quota accounting in both.
- `/api/webhooks/resend` (Svix/Standard Webhooks signature verification) → bounced/complained.
- A base React Email layout (wordmark "FTC Pitfund", accent `#1F6F5C`, plain footer with the
  support address `ftcexodius@gmail.com` and "Not affiliated with or endorsed by FIRST®"), plus the login code template.
  Prompts 2–3 add the other templates.
- Unit tests with a fake clock and a mocked Resend: quota budgets per priority, deferral, retry and
  backoff, idempotency, bounce.

### F. Design system and app shell

- Tokens exactly per plan §7 in `app/globals.css` (`@theme`). Inter via `next/font`. Global user-content wrapping rules (plan §3.1 #11).
- `components/ui`: every component listed in plan §7 "Components", built on Radix + shadcn
  patterns, including **ActionButton** (useTransition/useActionState, pending within the same
  frame, `aria-busy`, double-submit safe), **Dialog/Sheet/ConfirmDialog** following the overlay system,
  FileDrop with a progress prop, Textarea with auto-grow and counter, StatusBadge, TeamMark,
  EmptyState, Skeletons, Timeline, and a sonner Toaster styled to the tokens.
- `lib/client/use-action.ts`: a hook wrapping server actions that handles Result, network failure
  ("Couldn't reach FTC Pitfund…" + retry), toasts and field errors, so feature code stays small.
- **App shell** `app/(app)/layout.tsx`: 56 px top bar, role-aware nav (coach: Pitches/Sponsors/Team;
  sponsor: Pitches/Company; admin area: Review/Directory/System), a notification bell (popover
  list, mark read optimistic, unread count from the viewer query, refresh on focus), an avatar menu
  (account, admin switch if `is_admin`, sign out), mobile menu sheet. Segment `loading.tsx`,
  `error.tsx` (retry + reference id), a global `not-found.tsx`. `useLinkStatus` pending indicators.
- Placeholder pages for each nav destination with proper empty states. **Prompts 2–3 replace them.**
- `/dev` (persona switcher, reset data, Mailpit link) and `/dev/ui` (every component in every
  state, including 5,000-char unbroken strings, every overlay size, ActionButtons wired to fake
  slow/failing actions). Guarded per plan §5 Security; add the production-404 E2E test.

### G. Testing, QA harness and CI

- Vitest config (unit + integration against local DB, transaction rollback per test).
- Playwright config with persona `storageState` fixtures produced via the `/dev` sign-in endpoint
  (not by UI login), Mailpit API helper for OTP, and base URL from env.
- **`npm run qa`** implemented fully per plan §10 (routes × personas × 375/768/1280;
  screenshots; console/network/exception failures; horizontal overflow and text-overflow
  detection; axe serious/critical after animations settle; overlay width, close and focus-trap
  checks; TTFB/LCP/CLS capture with budgets; ActionButton pending-latency check on `/dev/ui`;
  `qa/report.md`). Routes are discovered from a single `tests/qa/routes.ts` registry that prompts 2–4
  extend. `qa/` output is gitignored.
- E2E in this prompt: email-code login (reads Mailpit), Google button renders, sign out, welcome
  role choice, account page edit, `/dev` 404 in production build, isolation smoke test.
- `.github/workflows/ci.yml`: install → check → `supabase start` → migrate → seed → build →
  e2e. Cache wisely.
- `npm run check` = `tsc --noEmit` + eslint + vitest.

### H. Docs for the next agent

- Rewrite `CLAUDE.md` for v2: product summary, core rules (plan §1), stack, module layout, the
  action shape (validate → authz → data → audit → notify → `after(drainOutbox)` → revalidate →
  Result), commands, the QA gate, the "never do manual SQL / never ask Anish to click-test" rule,
  and the pointer to `prompts/rebuild/00-REBUILD-PLAN.md`. Keep the Next.js "read the bundled docs" note.
- New `.claude/rules/` files: `architecture.md`, `data-and-auth.md`, `ux-contract.md` (plan §3.1 +
  §7 overlay rules), `testing-and-qa.md`. Short, specific, and consistent with the plan.
- Rewrite `prompts/_NEXT-SESSION.md`: "Rebuild in progress; prompt 1 done; run
  `prompts/rebuild/02-team-experience.md` next", plus anything the next agent must know that you
  discovered (surprises, deviations, known gaps).

## Verification protocol (mandatory before you finish)

1. `npm run setup` from a clean state (`supabase stop --no-backup` first) works with no manual intervention.
2. `npm run check` green. `npm run build` green.
3. `npm run dev`, then use the app yourself in a real browser (Playwright script or a browser MCP):
   - Log in via email code (fetch the code from Mailpit). Check the wrong-code, expired-code and
     resend states. Sign out.
   - Use `/dev` to switch through every persona; confirm each lands in the right shell.
   - Open `/dev/ui`: click every ActionButton (slow, success, fail), open every dialog/sheet at
     375 and 1280, and verify 5,000-char strings wrap everywhere.
   - Check the browser console and network panel on every page: zero errors, zero unexpected failed requests.
   - Throttle the network (Playwright `route` delays / offline) to confirm loading skeletons
     and the "Couldn't reach FTC Pitfund" state.
4. `npm run e2e` and `npm run qa` green. **Open the screenshots in `qa/screens/` and look at them.**
   Fix anything that looks cheap, cramped, misaligned or unfinished against plan §7, then re-run.
5. Kill the dev server, drain the outbox with a fake quota-exhausted state (seed `edge`), and
   confirm queued/deferred rows behave per the tests.
6. Re-run everything after your last fix.

## Done means

- The v1 app is gone from branch `rebuild` (tag `legacy-v1` pushed), and the new foundation builds.
- A fresh clone runs `npm install && npm run setup && npm run dev` with only Docker as a prerequisite.
- Auth (email code end to end locally; Google wired and ready for credentials), viewer, authz
  (with a test matrix), outbox (with tests), design system, shell, `/dev`, `/dev/ui`, the seed
  scenarios, `check`/`e2e`/`qa` and CI all exist and pass.
- `CLAUDE.md`, `.claude/rules/*` and `prompts/_NEXT-SESSION.md` describe v2.
- Commit in logical commits on `rebuild` (conventional messages, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`), then `git push -u exodius rebuild`.
  Run `git ls-files` on new docs to prove they landed (note `.gitignore` rules; update them for v2).
- The final message to Anish: what exists now, what was verified and how, and any deviation from the plan with its reason. It must be short.
