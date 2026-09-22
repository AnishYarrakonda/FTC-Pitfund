# Prompt 01: Add the missing `connection()` calls in four route handlers

## Ground rules (read first)

- Read `CLAUDE.md` and every file in `.claude/rules/` before touching anything — this Next.js runs with
  `cacheComponents: true` and has breaking changes from what you may know; when in doubt, check
  `node_modules/next/dist/docs/`.
- Work on a branch (don't commit to `main`). This repo auto-deploys to production on push to `main`, so
  a human reviews and merges — you are not expected to push to `main` yourself.
- Never hand-write SQL against a database. Never touch v1 resources (Vercel project
  `ftc-sponsorship-portal`, Clerk, Supabase `qqizqbtwigyedgskoezm`) — they don't exist in this repo's scope
  anyway, but the rule is absolute if you ever see them referenced.
- Before committing: `npm run check` (typecheck + lint with 0 warnings + Vitest) must be green.
- Follow this project's existing code style exactly — don't introduce a different pattern than what's
  already in the file.

## Context

`.claude/rules/architecture.md` states: *"Route handlers that touch the DB call `await connection()` first."*
This is a real requirement of Next.js `cacheComponents: true` (dynamic/DB-touching work needs to opt out of
the static/cached rendering path explicitly), not a style preference.

Four route handlers touch the database indirectly (through a helper that queries) but never call
`connection()`:

1. `app/api/revalidate/route.ts` — calls `revalidateTag` (from `next/cache`); check whether it needs
   `connection()` or whether `revalidateTag` alone is sufficient. If it turns out this one doesn't touch the
   DB at all, say so in your summary instead of adding a needless call.
2. `app/api/auth/send-email/route.ts` — calls `enqueueEmail`/`sendNow` from `@/lib/server/email/outbox`,
   which read/write the database. This is production-critical: it's how sign-in codes get sent.
3. `app/api/webhooks/resend/route.ts` — calls `markBounced` from `@/lib/server/email/outbox`. Also
   production-critical: this is how email bounces get recorded.
4. `app/api/dev/sign-in/route.ts` — calls `loadViewer` and `signInAsPersona`, both of which touch the DB.
   This route is dev-only (`app/api/dev/sign-in` 404s in production per `devToolsEnabled()`), so it's lowest
   priority, but fix it too for consistency.

Find an existing route handler in this codebase that already does this correctly (e.g. one under
`app/api/cron/daily/route.ts` or similar) and match its exact pattern — where the `connection()` import
comes from, and where in the function it's called.

## Task

1. Read `app/api/cron/daily/route.ts` (or grep for `await connection()` across `app/api/`) to find the
   correct import and call pattern already used in this codebase.
2. For each of the four files above, add `await connection()` as the first line inside the handler
   (after auth/signature checks if those don't touch the DB, before any DB-touching call) — unless your
   investigation of `app/api/revalidate/route.ts` shows it genuinely doesn't need it, in which case leave
   it and explain why in your summary.
3. Write or extend a test that would have caught a missing `connection()` call if one exists as a pattern
   in this codebase (check `tests/unit/` for anything that already asserts this convention, e.g. via a lint
   rule or static check — `.claude/rules/architecture.md` mentions "Route handlers that touch the DB call
   `await connection()` first" as an invariant, so there may already be a test enforcing it that these four
   files are failing). If no such test exists, don't invent a new testing pattern from scratch — just make
   the code change and rely on `npm run check` + a manual read-through.
4. Run `npm run check` and confirm it's green.
5. Commit with a message in this repo's style (terse, present tense, explains the user-facing or
   architectural reason — look at `git log --oneline -20` for examples), ending with:
   ```
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```
   (or your own agent's equivalent attribution line if Antigravity has one).

## Done when

- All four files call `connection()` correctly (or you've explained in your summary why one doesn't need it).
- `npm run check` passes.
- No unrelated files changed.
