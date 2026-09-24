# What's left — FTC Pitfund v2

Written 2026-09-21, updated 2026-09-24 after a full re-verification pass. **The app is live at
https://pitfund.org, works, and has no known open issues.** Every core flow (sign-in, team/company setup,
admin approval, pitching, matching) has been used successfully in production.

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

- **Landing page LCP is 2441 ms against a 2000 ms budget.** Flagged and parked by the owner already —
  not a bug to fix without being asked.
- **A cosmetic UI/UX audit** (`docs/ui_ux_audit_report.md`) existed before this doc and found small
  consistency issues (focus-ring styling, an empty-state wrapper, a couple of hover states). Commit
  `aedd2f2 fix(ui): apply the verified findings of the UI/UX audit` fixed the confirmed ones and the report
  was deleted as part of a docs cleanup. If you want a fresh pass, ask for one — nothing from that report is
  carried into this list unverified.
