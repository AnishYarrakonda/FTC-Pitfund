# What's left — FTC Pitfund v2

Written 2026-09-21, updated 2026-09-24 after a full re-verification pass, corrected 2026-10-04 after a
production reliability audit. **The app is live at https://pitfund.org and has no known open defects.**

What has actually run in production (from the production database, 2026-10-04): admin sign-in with an
emailed code, the daily cron (every job green every day since launch), the admin digest email, and the
FIRST team-list sync (14,469 teams). **No team, company, join request or pitch has ever been created in
production** (the audit log holds two admin grants and nothing else), so setup → admin approval → pitch
→ match has only been exercised by the E2E suite on the local stack. The first real team or company is
the first production run of those flows: watch the admin System page and Vercel logs when it happens.

The staging Supabase project (`ftc-pitfund-staging`) backs Vercel *preview* deployments only. Production
reads no staging value and doesn't depend on it; `.github/workflows/keep-staging-alive.yml` explains how
it is kept from pausing.

No new features are planned right now.

## All four items from the 2026-09-21 list are resolved, verified directly against the code and live infra on 2026-09-24

1. **Route handlers and `connection()`.** `send-email`, `webhooks/resend` and `dev/sign-in` all call
   `await connection()` before touching the database. `revalidate/route.ts` doesn't — but on inspection it
   never touches the database itself (`revalidateTag` only expires cache tags), so it was never actually in
   scope for the rule. Nothing to fix.
2. **`%` in a dynamic path segment.** `/t/[number]/page.tsx`'s `parseNumber()` validates with
   `/^\d{1,6}$/` before ever touching the value — a literal `%...` fails that regex and returns `null`,
   which the page already renders as a normal not-found state. `/invite/[token]/page.tsx` has its own
   `safeDecode()` guard. Neither route can crash on a malformed `%`.
3. **"FIRST verified" badge.** Real feature, not a stale note: `team.verified` flows from
   `lib/server/data/teams.ts` into `TeamMark` and renders on the live public team page
   (`app/(public)/t/[number]/page.tsx:84`, `components/ui/identity.tsx`).
4. **Stray `PRODUCTION_CRON_SECRET`.** Confirmed gone via the Vercel API — production and preview envs on
   `ftc-pitfund` now only have `CRON_SECRET`.

`docs/agent-prompts/` is now unused and can be deleted next time someone's in here doing cleanup; left in
place for now since it's harmless.

## Explicitly not on this list (already decided, don't re-open)

- **Landing page LCP.** Was 2441 ms against a 2000 ms budget, parked by the owner. Since then: the hero's
  wave canvas (`components/home/effects/wave.ts`) had no `<canvas>` to attach to, and the `hp-rise` fade-in
  on the title/visual was delaying when Chrome considers the LCP element painted — both addressed in
  `components/home/hero.tsx`. The owner also raised the budget itself to 4000 ms and moved `npm run perf`
  off forced devtools throttling (`scripts/perf.ts`, `tests/qa/routes.ts`), a deliberate call — the last
  measured LCP (2515 ms) already clears the new budget regardless of whether the hero change alone would
  have. Don't re-tighten the budget without asking first.
- **A cosmetic UI/UX audit** (`docs/ui_ux_audit_report.md`) existed before this doc and found small
  consistency issues (focus-ring styling, an empty-state wrapper, a couple of hover states). Commit
  `aedd2f2 fix(ui): apply the verified findings of the UI/UX audit` fixed the confirmed ones and the report
  was deleted as part of a docs cleanup. If you want a fresh pass, ask for one — nothing from that report is
  carried into this list unverified.
