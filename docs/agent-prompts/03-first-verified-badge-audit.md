# Prompt 03: Audit whether "FIRST verified" status is actually visible where it should be

## Ground rules (read first)

- Read `CLAUDE.md` and every file in `.claude/rules/` before touching anything, especially
  `.claude/rules/ux-contract.md` (copy, layout, overlay rules) and `.claude/rules/data-and-auth.md`
  (team/company approval flow).
- Work on a branch (don't commit to `main`). This repo auto-deploys to production on push to `main`.
- **This is an investigation task first, a build task only if the investigation finds a real gap.** Don't
  build new UI on spec here — confirm what's missing, then propose the smallest change that closes the gap,
  matching existing patterns exactly (`.claude/rules/ux-contract.md`'s tokens, components, copy rules).
- Before committing anything: `npm run check` must be green, and any UI change needs its states shown on
  `/dev/ui` per `.claude/rules/ux-contract.md`.

## Context

A previous QA session's notes said: *"the achievements 'Verified by FIRST' badges are NOT built."* That note
has since been deleted along with the document it lived in, so treat it as a secondhand tip, not a
confirmed bug report.

Reading the current code turns up a real verification system already wired through the backend:
- `verified` / `isVerified` fields are read and passed through `lib/server/data/teams.ts`,
  `lib/server/data/pitches.ts`, `lib/server/data/admin-review.ts`, `lib/server/data/inbox.ts`,
  `lib/server/data/public-team.ts`, and referenced in `app/actions/pitches.ts` and `app/actions/admin.ts`.
- `docs/RUNBOOK.md` documents the admin-facing side of this: *"Approve (they get an email and the app opens
  up; the check mark shows on their public page)."*
- The only place a literal "FIRST verified" badge string was found is `components/home/hero.tsx` — inside
  the landing page's static illustration of what the product looks like. That's decorative marketing mockup
  content, not a real feature, and isn't evidence either way about the real app.

So there are two real possibilities, and this task is to find out which:
1. **The backend tracks verification correctly, but the actual public-facing checkmark badge doesn't render**
   on the real public team page (`app/(public)/t/[number]/page.tsx`) or wherever else `docs/RUNBOOK.md`
   implies it should ("the check mark shows on their public page"). This would be a real, small bug.
2. **It's already built and working**, and the old QA note either meant something more specific that no
   longer applies, or was simply wrong/stale.

## Task

1. Read `app/(public)/t/[number]/page.tsx` in full and confirm: does it render any visual indicator that a
   team is FIRST-verified / admin-approved? Check the underlying data it receives from
   `lib/server/data/public-team.ts` — does that function even return a verification flag to the page?
2. Check the sponsor-side equivalent too — does a company's public-facing surface (wherever companies are
   shown to teams, e.g. the sponsor directory) show any equivalent "approved" indicator? The product's core
   rule (`CLAUDE.md` "Core rules") is that **both** teams and companies are admin-approved — check whether
   the UI is consistent between them, or whether verification/approval status is visibly shown for one side
   and not the other.
3. Sign in locally as different personas (`http://127.0.0.1:3000/dev`, see `lib/shared/personas.ts`) and
   actually look at the pages a real visitor or coach would see. Screenshot what you find.
4. Decide, with evidence:
   - **If verification status already renders correctly everywhere it should:** say so plainly in your
     summary, cite the file/component that renders it, and stop — no code change needed. This closes the
     item.
   - **If it's genuinely missing somewhere it should appear:** propose the smallest fix (likely: read the
     `verified` field where it's missing and render an existing badge/pill component — check
     `components/ui/` for one that already exists rather than building a new one; `.claude/rules/ux-contract.md`
     lists the design tokens to use). Add the new state to `/dev/ui` per this project's convention for every
     new UI state. Add a test (unit or E2E, whichever fits the existing test suite's pattern for this kind of
     page) that would fail without the fix.
5. Run `npm run check` and confirm green. If you touched a public route, also sanity-check
   `npm run qa` isn't newly failing on it if you have time to run it (it's a longer-running gate — don't block
   on it if the environment doesn't have Docker/Supabase set up).
6. Commit with a message in this repo's style, ending with:
   ```
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```

## Done when

- Your summary states plainly which of the two scenarios above is true, with the specific file/line as
  evidence — not a guess.
- If a real gap was found and fixed: the fix matches existing design-system patterns, is on `/dev/ui`, has a
  test, and `npm run check` is green.
- If no gap was found: no code was changed, and the summary explains what was checked so this doesn't need
  re-investigating later.
