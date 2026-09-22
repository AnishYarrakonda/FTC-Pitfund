# Architecture (v2)

This file is the current architecture. The original design (`prompts/rebuild/00-REBUILD-PLAN.md` §5) is history and drifts from it.

## Rendering
- `cacheComponents: true`. Anything that reads `cookies()`, `headers()`, `searchParams` or the database must
  sit under a `<Suspense>` boundary (a `loading.tsx` counts). Signed-in shells (`app/(app)/layout.tsx`,
  `app/admin/layout.tsx`) wrap their content in Suspense and set `export const instant = false` because they
  redirect signed-out visitors.
- Route handlers that touch the DB call `await connection()` first.
- Public pages that change rarely (`/t/[number]`, sponsor directory) use `'use cache'` + `cacheTag` +
  `cacheLife`; invalidate with `revalidateTag(tag, 'max')` or `updateTag` in actions. Tag names live in
  `lib/server/cache-tags.ts`. `POST /api/revalidate` (Bearer `CRON_SECRET`) expires them from outside the app
  (the seed script calls it). Authed pages are dynamic.
- `notFound()` inside Suspense streams a 200, and production builds stream every dynamic route's static shell
  first, so a page-level 404 is a soft 404 (200 + 404 UI + `noindex`). Only `next dev` or a check in
  `proxy.ts` gives a real 404 status (see `/t/[number]`).
- `DEBUG_QUERIES=1 npm run dev` logs every query; keep list pages at ≤5 queries with no sequential independent awaits.
- React Activity keeps hidden routes mounted: navigating back preserves form state. Design for it.

## Layers
- `proxy.ts`: Supabase session refresh + `x-pathname` header. No authorization.
- `lib/server/viewer.ts` `getViewer()`: React `cache()`, one query (user, team or company, pending join
  request, unread count). Lazily creates the `users` row on first sign-in.
- `lib/server/authz.ts`: `requireViewer / requireAdmin / requireTeamMember / requireSponsorMember /
  requireApprovedSponsor / requireNoOrg`. Throw `AppError`. Membership mismatch → `NOT_FOUND`.
- `lib/server/page-guards.ts`: pages use `pageViewer()` and `guardPage(() => requireX())` (redirects).
- `lib/server/data/*`: every query. Functions take the viewer. `getDb()` joins the current transaction.
- `lib/server/transaction.ts` `inTransaction()`: the boundary actions use (no query handle exposed).
- `lib/server/result.ts` `defineAction(schema, handler)`: validation → handler → `Result`; `mapDbError`.
- `app/actions/*`: thin server actions composed from the above.

## Import boundaries (ESLint `no-restricted-imports`)
`@/lib/server/db`, `@/lib/server/schema`, `@/lib/server/supabase-admin`, `drizzle-orm`, `postgres` are
importable only from `lib/server/**`, `scripts/**`, `tests/**`. Every `lib/server` file imports `server-only`.
Scripts and Vitest stub `server-only` (`scripts/lib/server-only-stub.mjs`, vitest alias).

## Email
`enqueueEmail` (in the action's transaction) → `after(() => drainOutbox())`. Budgets per rolling 24 h:
priority 0 auth 100 · 1 transactional 90 · 2 admin 90 · 3 daily summary 90. Resend `idempotencyKey = outbox.id`.
Transient failures back off (1, 2, 4, 8 min; 5 attempts). Dev sends to Mailpit over SMTP unless
`EMAIL_TRANSPORT=resend`. Auth codes come from the Supabase Send Email hook (`/api/auth/send-email`) and are
sent synchronously and **fail instead of deferring** when the quota is gone (a late code is useless); their payload is
scrubbed after sending. Templates: `lib/server/email/templates/`.

## Files
`lib/server/storage.ts` only. Buckets: `public` (served), `staging` (private, signed uploads, cleaned daily).
Browser uploads go to `staging` with a signed URL; `lib/server/uploads.ts` re-verifies the bytes and publishes
under a fresh name (never trust the browser's file). Read public objects over HTTP, not `download()`
(a bucket named `public` makes `storage.from('public').download()` hit the public-object route and fail "Bucket not found").
Overwriting a signed-upload path is a 409; `staging` refuses `text/html`.

## Jobs
One Vercel cron: `/api/cron/daily` → `lib/server/jobs.ts` `runDailyCron()`: drain outbox → admin digest
(`lib/server/digest.ts`, dedupe `digest:{date}:{email}`; sent every day to `DIGEST_RECIPIENTS` plus admins, leading with the emails sent in the last 24 h) → clean staging → copy FIRST's team list into `ftc_team_cache` (`lib/server/ftc-directory.ts`; weekly, or at once when empty; the team setup search runs over it, and `createTeam` refuses a number FIRST doesn't list) → re-check ≤20 unchecked FIRST records →
keepalive. One `cron_runs` row per job; System warns when a job is older than 36 h. Every job must be safe to run twice.
Add jobs there. `npm run cron:run` invokes it locally.

## Admin and email helpers
- Actions send email with `await scheduleDrain()` (`lib/server/email/drain.ts`), not a bare `after(drainOutbox)`: in dev the
  `pitfund-simulate` cookie `email-429` / `email-500` makes the provider fail like Resend does.
- Correlated subqueries in `sql\`\`` must name the outer column literally (`"sponsors"."id"`): in a single-table select
  Drizzle renders `${sponsors.id}` unqualified, which silently binds to the inner table.
- Dates inside raw `sql\`\`` need `.toISOString()` + a cast; the postgres driver can't serialize a `Date` there.
- Admin lists paginate with `lib/server/data/keyset.ts` (cursor on the sort key + id, 25 per page).

## First-load JS (plan §6: ≤170 KB gzipped per route; `npm run perf` fails over budget)
React + Next alone is ~145 KB, so client code on any page gets ~25 KB. Keep it there:
- **Overlays load on first use.** `components/ui/dialog.tsx` keeps the Radix Dialog API (`Dialog`, `DialogTrigger`,
  `DialogContent`, `DialogClose`, `Sheet*`, `ConfirmDialog`) but loads Radix and the markup (`dialog-impl.tsx`) on hover,
  focus or open. Menus and popovers that must render Radix at once (account menu, bell, mobile nav, admin row menu) use
  `useLazyComponent` (`lib/client/lazy.ts`): a lookalike trigger, the real component on first interaction.
- A dialog opened without a trigger returns focus to whatever was focused when it opened (`openerRef` in `dialog.tsx`).
- **pdf.js 6:** `PDFDocumentProxy` has no `destroy()`; `openPdf()` in `lib/client/pdf.ts` returns a document whose `destroy` calls the loading task's.
- **next/image and local Supabase:** the optimizer refuses 127.0.0.1 unless `dangerouslyAllowLocalIP`; it is on only when Supabase itself is local.
- **Toasts:** import `toast` from `@/lib/client/toast` (never `sonner`). `<Toaster>` mounts only in layouts with actions
  and fetches Sonner at idle so offline errors can still show.
- **pdf.js and the viewer:** `PdfViewer` is a shell (figure, toolbar, thumbnail); `pdf-viewer-impl.tsx` loads near the viewport.
  Upload helpers (`lib/client/pdf.ts`, `upload.ts`, `image.ts`) are imported when a file is chosen.
- **Choice controls are native inputs** (`checkbox.tsx`, `choice.tsx`); `Avatar` is plain markup. Import `Banner` and
  `StatusBadge` from their own modules in client code, not from `feedback.tsx`.
- **`cn` is ours** (`lib/shared/cn.ts`), checked against tailwind-merge on every class string in the repo
  (`tests/unit/cn.test.ts`). Add a rule there when that test fails.
- **Server components for static lists**, client components only for the controls (see `components/members/`).
  A server component can't render `Button` without `asChild` (it attaches an onClick): use `buttonVariants()` on a plain element.
- Turbopack bundles whole modules: one import from a big client module ships all of it. Split modules instead.
- The landing page is static (`components/home/*`, styles scoped to `.hp` in `app/(public)/home.css`). Two islands: one
  reads the session cookie; `<HomeEffects>` imports `components/home/effects/*` at idle (canvases, menus, dialogs built on
  first open, carousels), one short task per effect. Below-the-fold sections use `content-visibility: auto`; QA's
  `settle()` renders them before screenshots, overflow checks and axe. `/login` renders the form in the static shell
  and reads `?intent`, `?next`, `?error` in the browser (a Suspense fallback swap would wipe what the user typed).
  "Find where to start" routes what a visitor types with `effects/find-match.ts`: a scored, weighted word index
  with prefix and edit-distance fallbacks, no model and no request. Change the weights only against
  `tests/unit/find-match.test.ts`, and add the sentence to that corpus first.
- **CSS is inlined into the HTML** (`experimental.inlineCss`): a render-blocking stylesheet request competing with the scripts
  held `/login` first paint to ~2 s on Slow 4G. Images are served AVIF first (`images.formats`); the landing hero is the LCP.
- **The logo cropper loads on file pick** (`components/uploads/logo-cropper-impl.tsx`), like the dialog and
  PDF viewer. Sonner and the toast body load on the first toast.
- **The bell is a to-do list, not a feed**: `lib/shared/notifications.ts` `ACTIONABLE_TYPES` decides what
  it counts, and `resolveNotifications(subjectKey)` clears an item for everyone on the org when the thing
  is handled. Every event still writes a notification row.
- **Times inside client components use `<TimeText>`** (`components/ui/time-text.tsx`): server and browser format them at
  different moments and in different time zones, which fails hydration (#418). Format numbers with an explicit `'en-US'`.
- **Font fallbacks are calibrated beyond Arial** (`app/globals.css`): Liberation Sans, Roboto and DejaVu Sans faces keep text
  from reflowing when Inter swaps in on Linux and Android (CI runs Linux). Don't remove them from `--font-sans`.
- Measure with `npm run perf -- --only bundles` (gzip -9 of the scripts the HTML references, as Next reports sizes).

