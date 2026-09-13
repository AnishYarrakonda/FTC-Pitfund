# Rebuild Prompt 3 of 4: Sponsor Experience, Admin and Operations

Copy everything below into a fresh Claude Code session at the repository root
(`ftc_sponsorship_portal`). It is self-contained.

---

## Your role

You own the **company (sponsor) side, the admin console, the remaining transactional emails,
and the daily cron** of the FTC Pitfund rebuild. Prompt 1 built the foundation, and prompt 2 built
the coach side (onboarding, team profile + PDF, public team page, directory, pitch composer, pitch
tracking, generic invites, `PitchView`). Both are on branch `rebuild`.

Work loop: **inspect → plan internally → implement → test → run the app and look at it →
fix → verify again.** Do not stop at a partial implementation. Do not declare success because it
compiles. Never ask Anish to do manual steps (no SQL, no dashboard clicks, no click-testing).
Make obvious implementation decisions yourself. Stop to ask only if a product rule below is
genuinely contradicted by reality.

## Read first (in this order)

1. `git checkout rebuild && git pull`. Read `prompts/_NEXT-SESSION.md` and confirm prompts 1–2 are
   done. Run `npm run setup` (or `db:reset`), `npm run check` and `npm run e2e`. If anything from 1–2 is
   broken, fix it first and record what you fixed.
2. `prompts/rebuild/00-REBUILD-PLAN.md`: **the source of truth.** Read all of it; §2, §3, §5
   (email outbox, jobs) and §7 matter most here.
3. `CLAUDE.md`, `.claude/rules/*`.
4. The existing code you must build on: `lib/server/*` (schema, authz, viewer, result, audit,
   notify, email outbox, storage), `components/ui/*`, `components/pitch/pitch-view.tsx`,
   `app/invite/[token]`, the logo upload implementation in `/team`, `notifyAdminsOfReport()`,
   `scripts/seed/*`, `tests/qa/routes.ts`, `/dev`, `/dev/ui`. **Reuse them; do not fork parallel versions.**
5. `node_modules/next/dist/docs/` for Next 16 APIs you touch.

Where anything conflicts with the plan, the plan wins.

## Product in one paragraph

FTC Pitfund connects FIRST® Tech Challenge teams with companies that want to sponsor them.
Coaches (adults, one shared team account, no roles) pitch **approved** companies by answering that
company's own questions (≤10, or 3 defaults) plus an optional ask. **Company signup is open, but a
company is hidden from coaches until an admin approves it** (the admin researches the applicant's
name, title, LinkedIn and website offline). A company is one shared account with equal members;
only an **approved** company can invite coworkers. **An admin reviews every pitch** (Approve & send /
Send back with a note / Reject). Approved pitches appear in the company's inbox and every member is
emailed. A company responds **Interested** (both sides get each other's name, title, email and optional phone;
the pitch becomes *matched*) or **Not a fit** (optional reason). Admins also verify teams (a
checkmark), handle reports, suspend bad actors, and watch email quota and system health. $0
budget: Resend free is capped at 100 emails/day, so everything goes through the quota-aware outbox, never silently.

## Architecture you must follow

Server actions: **validate (zod) → authz guard → data function (transaction; state transitions
use `UPDATE … WHERE status = expected RETURNING`, zero rows → CONFLICT) → audit → in-app notify
→ enqueue email → `after(drainOutbox)` → revalidate → `Result`**. Only `lib/server/**` touches the
DB. UI follows plan §3.1 (the feedback contract) and §7 (the overlay system) **with no exceptions**:
anything content-heavy is a page, not a panel.

## Scope

### A. Company onboarding (`/welcome` → company branch). Replace the placeholder.

- Fields: company name, website (normalize + validate), your name, **your job title**
  (`users.job_title`), LinkedIn URL (optional, validated), plus the 18+ and Terms confirmations. Nothing else.
- Create in one transaction: `sponsors` row (`status='pending'`), membership, audit. No instant
  admin email: pending companies go in the daily digest (see F).
- Redirect to `/inbox`.

### B. Company home (`/inbox`) and profile (`/company`)

- **Pending state** (on `/inbox` and `/company`): a Banner explaining *"Your company is under review.
  Teams can't see {Company} until it's approved, usually within 1–2 days. We'll email you. Meanwhile,
  set up your profile and questions."* Plus a profile checklist (logo, what you look for, support types,
  questions). **Rejected** state: the admin's note + support email. **Suspended**: explain + support email.
- `/company` editor with a live **"What teams see"** preview (reuse the directory card and
  `/sponsors/[id]` presentation from prompt 2 as shared components; extract them if they aren't
  yet): logo (reuse the logo upload pipeline), name, website, city/state, region ("Where we
  sponsor", free text), "What we look for" (textarea), support types (checkbox group). Unsaved-changes
  protection. Saving invalidates `cacheTag('sponsors')` and the company's profile.
- **Questions editor:** shows "Teams answer our default questions" (lists them) with a **Customize**
  button → an editable list of 0–10 questions: prompt (≤200, required), helper text (≤300, optional),
  required toggle, **Move up/Move down buttons** (accessible, not drag-only), delete (confirm), add
  (disabled at 10 with a reason). "Reset to defaults" (confirm). Saving shows "Changes apply to new
  pitches; pitches already submitted keep the questions they answered."
- **Members:** list; invites via the generic `/invite/[token]` (`kind='sponsor'`, email
  `sponsor-invite`). **Invites are disabled while pending**, with the reason shown. Remove a member
  (confirm; never the last), Leave (not as the last member).

### C. Company pitch inbox (`/inbox`, `/inbox/[id]`)

- Companies only ever read pitches with status `sent`, `matched` or `declined` for **their**
  company (authz test). Groups: **New** (sent) · **Interested** (matched) · **Not a fit** (declined).
  Row: TeamMark (logo, name, `Team n`, verified check), city/state, one-liner, ask, received
  relative time. Empty states: pending ("You'll see pitches here once approved") and approved with no
  pitches ("No pitches yet. Teams can now find {Company} in the directory.").
- `/inbox/[id]`: `PitchView` (team header linking to `/t/{n}` in a new tab, answers, ask) plus an
  embedded PdfViewer (reuse prompt 2's component) and the sticky actions **Interested** / **Not a fit**,
  implementing plan §3.2 "Sponsor response" exactly:
  - `respondInterested`: `UPDATE … WHERE status='sent'` → `matched`, `responded_by/at`, snapshot
    `team_contact` (submitting coach: name, email, phone?; team name/number/public URL) and
    `sponsor_contact` (responder: name, job title, email, phone?; company name/website), audit,
    in-app notify all members of both orgs, email `match-team` to the submitting coach and
    `match-sponsor` to the responder (priority 1). The page then shows the **Connected** panel.
  - `respondNotAFit`: optional reason (Not aligned with our focus / Outside our region / Budget
    already allocated / Other + text) → `declined`, audit, in-app notify team members, email
    `pitch-not-a-fit` to the submitting coach (reason included only if given).
  - Withdrawn-while-open → read-only notice. Contact details are returned **only** for matched
    pitches, only to members of the two orgs (authz test).

### D. Admin console (`/admin`)

Top bar: Review · Directory · System. `requireAdmin` at the segment layout. Admins who also
belong to a team or company switch via the account menu.

- **Review (`/admin`):** tabs with live counts from one query: **Pitches** (in_review, oldest
  first, with "waiting 26 h" in warning color past 24 h), **Companies** (pending), **Teams**
  (unverified, newest first), **Reports** (open). Each tab has a list, an empty state ("You're all
  caught up") and pagination.
- **`/admin/pitches/[id]`**: a full-width page, never a panel. Left: `PitchView` exactly as the
  company will see it + PdfViewer. Right, sticky: team facts (verified?, created date, member
  names + emails, FIRST record status with links to `https://ftcscout.org/teams/{n}` and the public
  page, this team's other pitches with statuses), company facts, and decision actions:
  - **Approve & send** (no extra confirm, per plan §3.1 #7) → `sent`, `sent_at`, `reviewed_by/at`,
    audit, in-app to team members + company members, email `pitch-approved-coach` (to the submitting
    coach) and `new-pitch-sponsor` (to **every** company member).
  - **Send back** → dialog with a required note → `changes_requested`, email `pitch-sent-back`.
  - **Reject** → dialog with an optional note (shown to the coach if given) → `rejected`, email `pitch-rejected`.
  - Keyboard `A` / `S` / `R` and `J`/`K`, with visible KeyboardHints. After a decision, a toast (including
    email delivery state, e.g. "Sent to Acme · 3 people notified" or "…email delayed until tomorrow") and
    **auto-advance** to the next pitch in the queue, or "You're all caught up."
  - Conflict (another admin decided first) → "{Admin} already {decided} this pitch." + refresh.
  - If the pitch's company is not approved or the team is suspended, block approval with the reason.
- **Company review** (from the Companies tab or Directory): a Sheet (md) with applicant name, job
  title, email, LinkedIn link, website link, created date, and the profile so far. **Approve** → status
  approved, audit, email `sponsor-approved` to members, invalidate `sponsors` tag. **Reject** (note
  required) → email `sponsor-rejected`. **Suspend/Unsuspend** (confirm; suspending hides the company and blocks its members).
- **Team review** (from the Teams tab or Directory): a Sheet with team facts, members, the FIRST record
  (+ "Re-check FIRST records" action), public page link and ftcscout link. **Verify** (optimistic, undo
  toast) / **Unverify** / **Suspend** (confirm: hides the public page, blocks pitching, and withdraws
  in-review pitches with a coach notification).
- **Reports tab:** report detail (reason, details, reporter, link to page) with **Resolve** and
  **Resolve & suspend team**.
- **Directory (`/admin/directory`):** tabs Teams / Companies / People, search, cursor
  pagination, Table on desktop and List on mobile. Rows open the Sheets above; People rows offer
  grant/revoke admin (confirm; you can't revoke yourself), remove from org, suspend user. Delete team
  or company requires typing the name to confirm (and cascades storage cleanup).
- **System (`/admin/system`):** emails in the last 24 h `N/100` with a priority breakdown and the
  budget thresholds; queued (with `send_after`, "Send now" if budget allows); failed and bounced
  (error, Retry, Dismiss); storage used (sum of tracked bytes) vs 1 GB; DB size
  (`pg_database_size`) vs 500 MB; last cron run per job with a status, and a warning if older than 36 h;
  links to the Supabase usage dashboard, Resend and Sentry. Every threshold shows "upgrade when…"
  guidance (plan §9).
- Extend `notifyAdminsOfReport()` to also enqueue the instant admin email `admin-report` (priority 2).

### E. Emails added in this prompt

`match-team`, `match-sponsor`, `pitch-not-a-fit`, `pitch-approved-coach`, `new-pitch-sponsor`,
`pitch-sent-back`, `pitch-rejected`, `sponsor-approved`, `sponsor-rejected`, `sponsor-invite`,
`admin-report`, `admin-digest`. Each goes on the base layout, is short and specific, has one primary button
to the exact page, and has a plain-text alternative. Send every one to Mailpit and **look at each
rendered email**.

### F. Daily cron (`/api/cron/daily`) and `vercel.json`

- Authorized by `CRON_SECRET` (Bearer). Idempotent (safe to run twice). Each step runs in its own
  try/catch, and results are recorded in `cron_runs`:
  1. `drainOutbox()` until empty or out of budget.
  2. **Admin digest** (priority 3, dedupe key `digest:{date}`): new teams since the last digest (to
     verify), pending companies, open reports, pitches waiting > 24 h. Skip it if everything is empty.
  3. Delete `staging` objects older than 24 h.
  4. Re-check FIRST records for `record_status='unchecked'` teams (max 20 per run).
  5. A DB keepalive query (Supabase free pauses after 7 idle days).
- `vercel.json`: exactly one cron entry, `0 13 * * *` (Hobby allows 2 jobs, once daily, fired within the hour).
- `npm run cron:run` locally to invoke it with the secret.

### G. Seeds, tests, QA

- Extend `demo`/`empty`/`edge` so every state here is reachable instantly: pending, rejected and
  suspended companies, companies with default/custom/10 questions, inbox pitches in sent/matched/declined,
  in-review pitches older than 24 h, open reports, outbox rows sent/queued/failed/bounced, an exhausted
  quota (edge), a cron run history including a stale one.
- **Unit/integration:** admin and sponsor pitch transitions (legal/illegal and conflicts); contact
  snapshot visibility; company visibility rules (pending invisible to coaches, and still visible to
  itself and admins); invite restriction while pending; questions editor constraints; digest
  content and dedupe; cron idempotency; suspension side effects; the authz matrix extended to every new action.
- **E2E (plan §10 journeys 3, 4, 7, 8, 10):** admin send back → coach resubmits → admin approves
  (company members get the email in Mailpit) → company Interested → both see contacts; another pitch → Not
  a fit; pending company invisible to coaches → approve → visible; `sponsor2` gets 404 on `sponsor`'s pitches;
  exhausted quota → "email delayed" UI + System shows queued; keyboard-only admin review with A/S/R and auto-advance.
- Register every new route × persona (admin, sponsor, sponsor-pending, sponsor-new, sponsor2) in
  `tests/qa/routes.ts`, including sheets and dialogs.

## Verification protocol (mandatory before you finish)

1. `npm run db:reset`, `npm run check`, `npm run build`: green.
2. Use the product end to end in a browser (Playwright script or browser MCP) as three people at once
   (separate contexts via `/dev`): a new company signs up from `/login` → pending → admin approves → a coach pitches
   → admin sends back → coach resubmits → admin approves → the company clicks Interested → both see contacts.
   Check every email in Mailpit along the way.
3. Every page: zero console errors, zero unexpected failed requests. Throttle to Slow 3G; every
   button acknowledges instantly and every wait is explained. Inject failures: make Resend return 429
   or 500 (mock transport), trigger an admin decision conflict from two contexts, remove the company mid-review;
   confirm the UI states in plan §3.2.
4. 375, 768 and 1280 px for every route, including the admin review page and sheets on mobile (sheets go full-screen).
   Seed `edge`: long strings, 10 questions and huge names never overflow.
5. `npm run e2e` and `npm run qa` on `demo` and `edge`: green. **Open and look at every
   screenshot** you are responsible for and hold them to plan §7. The admin console must feel calm and
   fast, not like an enterprise dashboard: no charts, no vanity metrics. Fix and re-run.
6. Run `npm run cron:run` twice; confirm idempotency and `cron_runs` rows, and that System reflects them.
7. Re-run everything after your final fix.

## Done means

- Scope A–G works end to end locally, matches the plan's state machines, and is tested. `check`, `e2e`,
  `qa` and `build` are green.
- Every core rule in plan §1 now has at least one test somewhere in the suite. Add any that are missing.
- `prompts/_NEXT-SESSION.md` updated: prompt 3 done, notes for prompt 4, deviations with reasons.
- Commit logically on `rebuild` (conventional messages ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`) and `git push exodius rebuild`.
- The final message to Anish is short: what works now, how it was verified, and deviations.
