# Prompt 02: Investigate and fix a possible crash on a literal `%` in a URL

## Ground rules (read first)

- Read `CLAUDE.md` and every file in `.claude/rules/` before touching anything — this Next.js runs with
  `cacheComponents: true` and has breaking changes from what you may know; when in doubt, check
  `node_modules/next/dist/docs/`.
- Work on a branch (don't commit to `main`). This repo auto-deploys to production on push to `main`, so
  a human reviews and merges.
- **A 200 status code is not proof a page rendered.** This app's error boundaries return 200 with an error
  UI, and in this Next.js config, `notFound()` inside a Suspense boundary also streams a 200. Verify with a
  real browser (Playwright is set up in this repo — `npm run e2e` uses it, or drive one ad hoc) and read the
  actual page content / console errors, not just the HTTP status.
- Before committing: `npm run check` must be green, and add an E2E or unit test that reproduces the bug
  before you fix it (this repo follows test-first: a test that fails without the fix, passes with it).

## Context

A previous QA session on this app reported: a literal, non-decodable `%` in a dynamic path segment — for
example a request to `/invite/a%25b` or `/t/%25FF` — throws a React error (React DOM error #412) instead of
rendering a normal "not found"/invalid-link page. This has **not been reproduced or verified** in the current
session; production curl requests to these URLs returned HTTP 200 with an empty body, which most likely means
Vercel BotID silently blocked the non-browser request rather than confirming the page is fine.

Two relevant files:

- `app/(public)/invite/[token]/page.tsx` already has a `safeDecode()` helper:
  ```ts
  function safeDecode(value: string) {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  ```
  This suggests the invite page was built defensively against exactly this input from the start. If the bug
  still reproduces here, the guard isn't sufficient — find out why (maybe Next's own routing layer throws
  before this function ever runs, or maybe the codepath that breaks is somewhere the value flows to *after*
  `safeDecode`, e.g. rendering it back into the page).
- `app/(public)/t/[number]/page.tsx` has no equivalent guard. Its `parseNumber()`:
  ```ts
  function parseNumber(value: string) {
    return /^\d{1,6}$/.test(value) ? Number(value) : null
  }
  ```
  looks safe on its face (a non-numeric string just returns `null`), which means if this page does crash on
  a malformed `%`, the crash is likely happening in Next's own param-decoding step, *before* `parseNumber` is
  even called — i.e., this may be a framework-level issue, not something fixable by editing this file's
  logic. Confirm which layer actually throws before proposing a fix.

## Task

1. **Reproduce it first**, locally, with a real browser:
   - `npm run dev` (or the production build on `:3100` per this repo's E2E setup, since dev and production
     builds behave differently for routing/streaming in this codebase — see `.claude/rules/testing-and-qa.md`).
   - Visit `http://127.0.0.1:3000/t/%25FF` and `http://127.0.0.1:3000/invite/a%25b` in an actual browser (or
     drive one with Playwright) and check: does it render an error boundary, a blank page, or the expected
     "not found"/"invalid link" UI? Check the browser console for errors too.
   - Try a few variants if the first doesn't reproduce it: a bare `%` (`/t/%`), a doubly-encoded value
     (`/t/%2525FF`), and the exact strings from the original report.
2. **If it reproduces:** write a Playwright test in `tests/e2e/` (follow the existing patterns — see
   `.claude/rules/testing-and-qa.md` for conventions: assert `problems` — console errors, page errors, failed
   requests — is empty) that fails on the current code, then fix the root cause. If the crash is in Next's
   own routing layer rather than this app's code, the fix might need to happen in `proxy.ts` (this repo's
   session-refresh middleware — read its current contents and `.claude/rules/architecture.md`'s note on it
   before adding authorization-shaped logic there, since `proxy.ts` is documented as "session refresh only;
   no authorization") or via a differently-shaped route (e.g. validating and redirecting before the dynamic
   segment is parsed). Don't guess at the fix location — trace the actual stack trace / error first.
3. **If it does NOT reproduce:** don't invent a fix for a bug that isn't there. Write up what you tried, add
   a regression test that asserts the current (correct) behavior anyway (so this stays covered going
   forward), and say clearly in your summary that this was reported previously but could not be reproduced.
4. Run `npm run check` and `npm run e2e` (or at minimum the new/changed test file) and confirm green.
5. Commit with a message in this repo's style, ending with:
   ```
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```

## Done when

- You know definitively (with evidence — a screenshot, a console error, a stack trace) whether this bug is
  real, and your summary states CONFIRMED or NOT REPRODUCED, not "probably."
- If confirmed: a regression test exists that fails without your fix and passes with it, and the root cause
  (not just the symptom) is fixed.
- If not reproduced: a regression test exists asserting correct behavior, and no speculative code changes
  were made.
- `npm run check` is green.
