# What's left — FTC Pitfund v2

Written 2026-09-21, after launch. **The app is live at https://pitfund.org and works**: every core flow
(sign-in, team/company setup, admin approval, pitching, matching) has been used successfully in production,
`npm run check` is green (177 tests), and the last 13 commits before this doc were a dedicated QA pass that
found and fixed real bugs (auth redirects, orphaned owners, suspended-team edge cases, a stray-named env var
that used to crash every server render, and more — see `git log --oneline` for the full list). **Nothing here
is a "the app is broken" claim.** It's a short, honest list of loose ends found by re-reading the code and
checking production directly, each one small enough to hand to a coding agent as its own task.

No new features are planned right now — this is a cleanup list, not a roadmap.

## How this is organized

Each numbered item below has a matching prompt file in `docs/agent-prompts/`. Point a fresh coding agent
(Antigravity or otherwise) at one prompt file at a time — see `docs/agent-prompts/README.md` for the
"mini-prompt" you paste to kick one off. Don't hand an agent more than one prompt file per session; that's
the whole reason these are split up.

## 1. Four route handlers skip a required guard

**Confidence: confirmed by reading the code.** `.claude/rules/architecture.md` states the rule directly:
"Route handlers that touch the DB call `await connection()` first" (this project's Next.js runs with
`cacheComponents: true`, which requires it). Four handlers touch the database — through `enqueueEmail`,
`markBounced`, `loadViewer`, or `signInAsPersona` — but don't call it first:

- `app/api/revalidate/route.ts`
- `app/api/auth/send-email/route.ts` (production-critical: this is how sign-in codes get sent)
- `app/api/webhooks/resend/route.ts` (production-critical: this is how bounces get recorded)
- `app/api/dev/sign-in/route.ts` (dev-only, unreachable in production, lowest priority)

No crash has been observed from this in production, but it's a documented invariant of the framework
this app runs on and the project's own rules, and it's cheap to fix. → `docs/agent-prompts/01-route-handlers-missing-connection.md`

## 2. A literal `%` in a dynamic path segment may crash the page

**Confidence: reported by a previous internal QA session, not reproduced this session.** The claim: hitting
`/t/%25FF` or `/invite/a%25b` (a literal, non-decodable `%` in the URL) throws a React error instead of
showing a normal "not found" page. `/invite/[token]/page.tsx` already has a `safeDecode()` wrapper that
catches this, which suggests it was fixed there — but `/t/[number]/page.tsx` has no equivalent guard around
its own param handling, so the same class of bug may still be live there. A production curl of both URLs
returned HTTP 200 with an empty body, which most likely means Vercel BotID blocked the plain `curl` request
rather than confirming anything — this needs a **browser** reproduction, not a status code (this codebase's
own lesson: a 200 is not proof a page rendered; error boundaries return 200 too). → `docs/agent-prompts/02-percent-encoded-path-crash.md`

## 3. Whether "FIRST verified" badging is fully built is unclear

**Confidence: unclear — needs investigation before anything gets built.** A previous internal QA session's
notes said "the achievements 'Verified by FIRST' badges are NOT built." Reading the current code: there IS a
real verification system (`verified`/`isVerified` fields flow through `lib/server/data/teams.ts`,
`pitches.ts`, `admin-review.ts`, `inbox.ts` and others, and `docs/RUNBOOK.md` describes "the check mark
shows on their public page" once an admin approves a team). The only "FIRST verified" badge markup found is
inside the landing page's static illustration (`components/home/hero.tsx`) — that's decorative mockup
content, not a real feature. So either the note describes a real gap that isn't visible from a code read
(e.g., the checkmark doesn't actually render on the live public team page), or it was already resolved and
the note is stale. This needs to be checked against the actual public team page before deciding whether
there's anything to build. → `docs/agent-prompts/03-first-verified-badge-audit.md`

## 4. A stray, unused environment variable is sitting on Vercel

**Confidence: confirmed live via the Vercel API.** `PRODUCTION_CRON_SECRET` exists as an environment variable
on both the `production` and `preview` targets of the `ftc-pitfund` Vercel project. It is dead weight: the
app only ever reads `CRON_SECRET` (`lib/server/env.ts`), and `scripts/provision/vercel.ts` explains why —
`.env.local` keeps the value under the name `PRODUCTION_CRON_SECRET` locally, but pushes it to Vercel under
the name `CRON_SECRET`. Git history shows `CRON_SECRET` was briefly missing entirely and "crashing every
server render" until commit `9556f97` fixed it — the stray `PRODUCTION_CRON_SECRET` var on Vercel is very
likely a leftover from before that fix, never cleaned up. **This isn't a code task** — it's a one-line
deletion in the Vercel dashboard (or API), no prompt file needed. Say the word and it can be removed directly
next time we're in a session together.

## Explicitly not on this list (already decided, don't re-open)

- **Landing page LCP is 2441 ms against a 2000 ms budget.** Flagged and parked by the owner already —
  not a bug to fix without being asked.
- **A cosmetic UI/UX audit** (`docs/ui_ux_audit_report.md`) existed before this doc and found small
  consistency issues (focus-ring styling, an empty-state wrapper, a couple of hover states). Commit
  `aedd2f2 fix(ui): apply the verified findings of the UI/UX audit` fixed the confirmed ones and the report
  was deleted as part of a docs cleanup. If you want a fresh pass, ask for one — nothing from that report is
  carried into this list unverified.
