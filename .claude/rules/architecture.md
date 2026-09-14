# Architecture (v2)

Source of truth: `prompts/rebuild/00-REBUILD-PLAN.md` §5. This file is the short version.

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
priority 0 auth 100 · 1 transactional 90 · 2 admin 90 · 3 digest 70. Resend `idempotencyKey = outbox.id`.
Transient failures back off (1, 2, 4, 8 min; 5 attempts). Dev sends to Mailpit over SMTP unless
`EMAIL_TRANSPORT=resend`. Auth codes come from the Supabase Send Email hook (`/api/auth/send-email`) and are
sent synchronously; their payload is scrubbed after sending. Templates: `lib/server/email/templates/`.

## Files
`lib/server/storage.ts` only. Buckets: `public` (served), `staging` (private, signed uploads, cleaned daily).
Browser uploads go to `staging` with a signed URL; `lib/server/uploads.ts` re-verifies the bytes and publishes
under a fresh name (never trust the browser's file). Read public objects over HTTP, not `download()`.

## Jobs
One Vercel cron: `/api/cron/daily` → `lib/server/jobs.ts` `runDailyCron()` (records `cron_runs`). Add jobs there.
