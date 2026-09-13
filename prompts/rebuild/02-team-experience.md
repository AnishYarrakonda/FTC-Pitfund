# Rebuild Prompt 2 of 4: Team (Coach) Experience

Copy everything below into a fresh Claude Code session at the repository root
(`ftc_sponsorship_portal`). It is self-contained.

---

## Your role

You own the **entire coach-side product** of the FTC Pitfund rebuild: team onboarding, team
profile and PDF deck, the public team page, team membership, the sponsor directory, the pitch
composer, and pitch tracking. The foundation (stack, schema, auth, authz, email outbox, design
system, shell, dev tooling, QA harness) was built by prompt 1 on branch `rebuild`.

Work loop: **inspect → plan internally → implement → test → run the app and look at it →
fix → verify again.** Do not stop at a partial implementation. Do not declare success because it
compiles. Never ask Anish to do manual steps (no SQL, no dashboard clicks, no click-testing).
Make obvious implementation decisions yourself. Stop to ask only if a product rule below is
genuinely contradicted by reality.

## Read first (in this order)

1. `git checkout rebuild && git pull`. Confirm prompt 1 is done: `prompts/_NEXT-SESSION.md`
   should say so. If the foundation is missing or broken (`npm run setup`, `npm run check`,
   `npm run e2e` fail), fix the foundation first and record what you fixed.
2. `prompts/rebuild/00-REBUILD-PLAN.md`: **the source of truth.** Read all of it; §2, §3, §4 and
   §7 matter most here.
3. `CLAUDE.md` and `.claude/rules/*` (rewritten for v2 by prompt 1).
4. The existing foundation code: `lib/server/{schema,authz,viewer,result,notify,audit}.ts`,
   `lib/server/email/*`, `components/ui/*`, `lib/client/use-action.ts`, `scripts/seed/*`,
   `tests/qa/routes.ts`, and `/dev` + `/dev/ui`. **Use these building blocks; do not create parallel ones.**
5. `node_modules/next/dist/docs/` for any Next.js API you touch (Next 16: `proxy.ts`, `use cache`, `cacheTag`, `after()`).

Ignore v1 material if you find any (it lives only at git tag `legacy-v1`). Where anything
conflicts with the plan, the plan wins.

## Product in one paragraph

FTC Pitfund connects FIRST® Tech Challenge teams with companies that want to sponsor them.
Adult coaches sign in (Google or a 6-digit email code), create or join their team (one shared
team account, equal members, no roles), upload a sponsorship deck **PDF (≤5 pages, ≤10 MB)** and a
one-line summary, and get a public profile page at `/t/{number}`. They pitch **approved** companies
by answering that company's own questions (≤10, or 3 defaults) plus an optional ask. **An admin
reviews every pitch** before the company sees it. Companies respond Interested (contacts are
exchanged; *matched*) or Not a fit. **One pitch per team per company per season** (season = Sept 1 → Aug 31;
withdrawing frees the slot; rejection and not-a-fit do not). Teams can pitch immediately after
signup; admins later add a **verified** checkmark. $0 budget: email is capped at 100/day through a
quota-aware outbox, and must never fail silently.

## Architecture you must follow

Server actions: **validate (zod) → authz guard → data function (transaction for multi-writes)
→ audit → in-app notify → enqueue email → `after(drainOutbox)` → `revalidateTag`/`revalidatePath`
→ `Result`**. Only `lib/server/**` touches the DB (lint-enforced). UI uses `ActionButton`,
`use-action`, the overlay system, and the feedback contract in plan §3.1, **with no exceptions**.
Supabase Storage uploads go browser → signed upload URL (`staging`) → server `finalize` verifies
and moves the object to `public`.

## Scope

### A. Coach onboarding (`/welcome` → team branch). Replace prompt 1's placeholder.

Implement plan §3.2 "Coach first run" exactly:
- `lib/server/ftc-records.ts` (ported by prompt 1; finish it if needed): FIRST Events API when
  `FIRST_API_USERNAME/TOKEN` exist (4 s timeout), then FTCScout GraphQL fallback (4 s), cached in
  `ftc_team_cache` for 30 days. Returns `found | not_found | unavailable`. Unit tests with mocked fetch.
- Debounced lookup UI with every state: checking, found ("Is this your team?"), not found →
  manual name/city/state entry, unavailable → manual entry with `record_status='unchecked'`,
  **already on Pitfund → Request to join** (waiting screen with Cancel request).
- 18+ and Terms confirmations. Create team in one transaction (team + membership +
  `users.accepted_terms_at` + audit). No admin email here: new teams go into prompt 3's daily
  digest, which reads `teams.created_at`. Redirect to `/pitches`.
- One team per user (DB unique). A user already on a team or a company who reaches `/welcome` is redirected home.

### B. Team profile (`/team`)

- Edit in place: logo, team name, city/state, one-line summary (≤160, counter), website (URL
  normalization and validation). "Unsaved changes" and a leave warning. The save uses ActionButton and
  invalidates `cacheTag('team:{id}')` and the directory tag if needed.
- **Logo upload:** client-side resize/crop-to-square at 512 px WebP (canvas; no heavy crop
  library), direct upload, finalize, replace old object.
- **PDF deck upload:** implement plan §3.2 "PDF upload" exactly:
  - Client pre-check with lazy-loaded `pdfjs-dist`: MIME/magic, size ≤10 MB, pages ≤5, with exact
    messages. Render page 1 to a WebP thumbnail (≈1200 px wide).
  - A permission checkbox is required before uploading.
  - `createUploadUrl` action (authz; staging path) → **XHR PUT with progress events** and a Cancel
    that really aborts → `finalizeDeck` action: download from staging, verify magic bytes + `pdf-lib`
    page count + size, move to `public`, upload the thumbnail, update `teams` (pdf path, pages, bytes,
    thumb, `pdf_updated_at`, `media_consent_at`), delete previous objects, audit, invalidate the cache.
  - Stages shown: Uploading (bytes) → Checking your PDF… → Creating preview… → Done. Retry on network failure keeps the file.
- A preview card links to the public page ("View public page ↗").
- **Members section:** member list (avatar, name, email, "you"), **Invite by email** (creates
  an `invites` row, token hash, 14-day expiry, email `team-invite`), pending invites with Resend and
  Revoke, remove member (confirm; the last member cannot be removed), Leave team (confirm; the last
  member must instead be told to contact support to delete the team). **Join requests** banner
  with Approve / Decline (emails `join-request` to members, `join-decision` to the requester; in-app notifications both ways).
- `/invite/[token]`: build it **generically** for `kind = team | sponsor` (prompt 3 reuses it).
  States: valid → "Join {Org}" (requires sign-in with the invited email; if signed in with a
  different email, explain and offer sign out); expired; revoked; already used; already a member of
  another org (one org per user, so explain what to do); success → org home.

### C. Public team page (`/t/[number]`)

- Cached with `cacheTag('team:{id}')`, statically fast (plan §6 budgets). Suspended or missing
  teams → 404 page.
- Layout: TeamMark (logo, name, `Team 31579`, verified check with tooltip "Verified by FTC
  Pitfund"), city/state, summary, website, "Deck updated {date}".
- **PdfViewer:** lazy-loaded when scrolled into view or requested; renders pages
  fit-to-width with per-page skeletons, keyboard-accessible page navigation, a Download PDF link,
  and a graceful fallback ("Can't display the PDF here. Open it in a new tab"). It must work on iOS
  Safari (canvas rendering, not `<iframe>`).
- No deck yet → a clean state: "This team hasn't uploaded its sponsorship deck yet."
- `generateMetadata`: title, description (summary), OG image = deck thumbnail or logo.
- **Report this page:** a dialog with reason (inappropriate content / impersonation / spam / other),
  details, optional email, and BotID → a `reports` row + in-app notification to all admins. (Admin
  **email** for reports is added in prompt 3; leave a clearly named hook, `notifyAdminsOfReport()`,
  that prompt 3 extends.) Success: "Thanks. We'll review this page."
- No personal data (coach names, emails, phones) anywhere on the public page.

### D. Sponsor directory (`/sponsors`, `/sponsors/[id]`)

- Only `status='approved'` companies, never pending/rejected/suspended (test it).
- Search by name (URL param, debounced, server-rendered, pending indicator while results
  load) and support-type filter chips. Pagination (cursor, 25).
- Card: logo, name, location/region, "What we look for" (2-line clamp), support types, and **this
  team's status with the company**: Start pitch / Continue draft / In review / Needs changes / Sent
  / Matched / Pitched this season (links to the pitch). The directory list is cached by tag; the
  per-team status overlay is a separate uncached query merged in.
- Empty directory: "Companies are joining FTC Pitfund. Check back soon. Meanwhile, finish your
  team profile." with a link to `/team`.
- `/sponsors/[id]`: full profile + "You'll be asked" (the company's questions, or the defaults)
  + the state-appropriate primary action.

### E. Pitch composer (`/sponsors/[id]/pitch`)

Implement plan §3.2 "Pitch composer" exactly:
- "Start pitch" creates (or reuses) the season's draft for (team, company) and opens the composer.
  The season rule is enforced by the DB partial unique index; map conflicts to "You've already
  pitched {Company} this season." with a link to that pitch.
- The questions are the company's current questions (or defaults, with `{Company}` interpolated).
  Answers are stored keyed by question id; the prompt text is snapshotted at submit. If the company
  edits its questions after the draft started, show "{Company} updated its questions" and keep
  answers whose ids still exist.
- Auto-growing textareas, counters from 80% of 2,000 chars, **no minimum lengths**, required markers.
- Optional ask: SegmentedControl No ask / Amount (USD, whole dollars) / In-kind (note) / Open to discuss.
- Autosave (1 s debounce) with Saving / Saved / Couldn't save + Retry, plus a `sessionStorage` backup.
- Preview: side-by-side ≥1024 px, a tab below. It uses the shared **`PitchView`** component (build it
  in `components/pitch/pitch-view.tsx`; prompt 3 uses it for the admin review and the sponsor inbox):
  team header, answers, ask, deck thumbnail + open deck.
- Readiness: submit is disabled with explicit reasons until the team has a PDF + summary and all
  required answers are filled; each reason links or focuses its fix.
- Submit → ConfirmDialog (copy from plan §3.2) → action `submitPitch`: `UPDATE … WHERE status IN
  ('draft','changes_requested')`, set `submitted_by/at`, snapshot answers, audit, in-app notify
  admins, **enqueue instant admin email `admin-new-pitch`** (priority 2; subject "New pitch: Team
  {n} → {Company}"; body: team + verified state, company, one-liner, ask, and a primary button
  "Review pitch" → `/admin/pitches/{id}`) → redirect to `/pitches/{id}`.
- Resubmitting after "Send back": the admin's note is shown as a Banner at the top of the composer.
- Delete draft (confirm).

### F. Pitches home (`/pitches`) and pitch detail (`/pitches/[id]`)

- **Setup checklist** (until complete): Upload deck · Add one-line summary · Add logo · Invite a
  co-coach (optional). Progress + direct links. It disappears when the required items are done.
- **List** grouped: *Needs your attention* (changes_requested, draft) · *In progress* (in_review,
  sent) · *Matched* · *Closed* (rejected, declined, withdrawn). Row: company logo + name,
  StatusBadge, last event + relative time, a one-line next step ("Waiting for Pitfund review, usually within
  a day", "Waiting for {Company}", "Edit and resubmit"). Empty state → "Browse sponsors".
- **Detail:** header (company, status, next step), primary actions by state (Continue editing /
  Edit & resubmit / Withdraw with confirm while in_review|changes_requested|sent / Delete draft),
  **Timeline** from `audit_events` (Created, Submitted, Sent back with note, Approved & sent,
  Matched, Not a fit with reason, Withdrawn), with email delivery state where relevant ("Email to
  {Company} delayed until tomorrow; they can see it in FTC Pitfund"), the pitch via `PitchView`, and
  when matched, a **Connected** panel with the company contact snapshot (name, title, email, phone
  if present) and "We emailed you both."
- Withdraw action: allowed states only; if the pitch was `sent`, notify company members in-app
  + email `pitch-withdrawn` (priority 1); frees the season slot.

### G. Email templates added in this prompt

`team-invite`, `join-request`, `join-decision`, `admin-new-pitch`, `pitch-withdrawn`, each on
the base layout from prompt 1, plain and specific, with one primary button. Send them to local
Mailpit and **look at each rendered email** (Mailpit UI or render to HTML and screenshot).

### H. Seeds, tests, QA

- Extend `scripts/seed` so `demo`, `empty` and `edge` exercise everything here: teams with and without
  decks/logos, unchecked FIRST records, pending join requests, invites (valid/expired/revoked), drafts with
  partial answers, a company whose questions changed mid-draft, a 10-question company, an 8-page and a
  corrupt PDF fixture (for rejection tests).
- **Unit/integration:** season calculation and rule; coach-side pitch transitions (legal and
  illegal); `finalizeDeck` verification (pages, size, magic bytes, wrong owner); invite token
  lifecycle; join request approve/decline; directory visibility (approved only); FTC records
  fallback/caching; the public page excludes personal data.
- **E2E (plan §10 journeys 2, 5, 6, 9 + coach isolation):** full new-coach journey including a real
  PDF upload with progress and a rejected 8-page PDF; season rule and withdraw frees the slot; join
  request and invite (including wrong-email rejection); public page renders the viewer, Report works,
  suspended → 404; coach cannot open another team's draft (404).
- Register every new route × persona in `tests/qa/routes.ts`, including states reachable only by
  interaction (composer preview tab, invite dialog, report dialog, upload stages via a slowed route).

## Verification protocol (mandatory before you finish)

1. `npm run db:reset` then `npm run check` and `npm run build`: green.
2. Use the app as a real coach in a browser (Playwright script or a browser MCP), starting from
   `/login` with a brand-new email (code from Mailpit), through `/welcome`, team creation, deck
   upload, directory, composer, submit, then withdraw. Then, as `coach-joiner`, request to join and
   approve as `coach`.
3. On every page: zero console errors, zero unexpected failed requests. Throttle to Slow 3G
   and confirm every loading state is explained (no blank or frozen moments over 300 ms) and every
   button acknowledges instantly. Inject failures (abort the storage PUT, make the FIRST API time out,
   make an action return UNAVAILABLE) and confirm the error states from plan §3.2.
4. Test at 375, 768 and 1280 px. Seed `edge` and confirm 5,000-char strings, 60-char team names and
   10 long questions never overflow or overlap.
5. `npm run e2e` and `npm run qa` (seeds `demo` and `edge`): green. **Open and look at every
   screenshot** for the routes you built. Hold them to plan §7 (Stripe-level restraint: hierarchy by type
   and spacing, few boxes, no clutter). Fix anything that looks cramped, cheap, misaligned or
   unfinished, and re-run.
6. Measure: public team page TTFB/LCP and first-load JS within plan §6; `/pitches` and
   `/sponsors` render with ≤5 queries and no sequential independent awaits (log the query count in
   dev to prove it).
7. Re-run everything after your final fix.

## Done means

- Every item in Scope A–H works end to end locally, matches the plan's state machines, and is
  covered by the listed tests. `check`, `e2e`, `qa` and `build` are green.
- `PitchView`, `/invite/[token]`, `notifyAdminsOfReport()` and the seed data are ready for prompt 3.
- `prompts/_NEXT-SESSION.md` updated: prompt 2 done, anything prompt 3 must know, deviations with reasons.
  Update `CLAUDE.md`/rules only if a convention changed.
- Commit logically on `rebuild` (conventional messages ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`) and `git push exodius rebuild`.
- The final message to Anish is short: what works now, how it was verified, and deviations.
