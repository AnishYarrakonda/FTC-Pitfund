# FTC Pitfund: Rebuild Plan

**Written 2026-09-13. This is the source of truth for the rebuild.** It was produced from a
full inspection of the v1 app (code, production database, live site) and a high-intensity
product interrogation with Anish. Every product decision below was confirmed by him. Anything
marked *default* was chosen by the planner and may be changed by Anish, but an execution agent
must not change it on its own.

The v1 app is preserved at git tag `legacy-v1`. It is a reference for what went wrong, not a
constraint. `CLAUDE.md`, `.claude/rules/*`, `prompts/revamp/*`, `prompts/audits/*`, `docs/*` and
most of the auto-memory describe **v1** and are superseded wherever they disagree with this file.

Execution happens in four self-contained prompts, run in order in fresh sessions:

| # | Prompt | Delivers |
|---|--------|----------|
| 1 | `01-foundation.md` | Branch, clean slate, stack, schema, auth, authz, email outbox, design system, app shell, dev tooling, test and QA harness |
| 2 | `02-team-experience.md` | Coach onboarding, team profile + PDF, public team page, members, sponsor directory, pitch composer, pitch tracking |
| 3 | `03-sponsor-and-admin.md` | Sponsor onboarding and profile/questions, sponsor pitch inbox and responses, matching, admin review/directory/system, all emails, cron |
| 4 | `04-launch-polish-qa.md` | Landing page, legal, SEO, full-product QA sweep, performance pass, docs rewrite, automated provisioning, launch checklist, merge |

---

## 1. Product architecture

### What the product is

FTC Pitfund connects **FIRST® Tech Challenge teams** with **companies that have chosen to
sponsor robotics teams**. A team uploads its sponsorship deck once, then writes a short pitch
for a specific company by answering *that company's own questions*. A person on the Pitfund
team reviews every pitch before the company sees it. When a company is interested, both sides
get each other's contact details and continue off-platform. The platform never touches money.

### The pitch (landing-page positioning)

> **Sponsorship pitches companies actually read.**
> Companies on FTC Pitfund are already looking for robotics teams to support. Upload your
> team's deck once, answer each sponsor's own questions, and every pitch is checked by a
> real person before it lands.

For companies: *"Pitches from FTC teams, answering your questions, already screened. One
inbox, one click to connect."*

Why it should exist:
- **Teams** today cold-email companies with generic decks, get no replies, and have no idea
  which companies even sponsor teams. Pitfund gives them a list of companies that *want*
  pitches, and tells them exactly what each company wants to know.
- **Companies** that sponsor teams today run applications through ad-hoc forms and inboxes
  full of unscreened, generic requests. Pitfund delivers screened pitches that answer their own
  questions, in one place, and makes saying yes a single click.

### Users

| User | Who | Account |
|------|-----|---------|
| Coach | Adult (18+) coach or mentor of an FTC team. **Adults only; no student accounts.** | Member of exactly one team account |
| Sponsor member | An employee of a company | Member of exactly one company account |
| Admin | Anish and the people he adds | `users.is_admin = true` |

Teams and companies are each **one shared account.** One member is its `owner`; everyone else is an
`editor`. Both can do everything the org does — write pitches, edit the profile, answer companies —
but only the owner changes who is on the account, and the owner can't leave without handing it over.

> Superseded 2026-09-16. The original rule was "equal members, no roles", which meant a coach who
> joined later could remove the coach who created the team.

### Core rules (confirmed)

1. **Teams pitch sponsors.** Pitches go **only** to companies already on the platform and approved.
2. **Team portfolio = one uploaded PDF, max 5 pages, max 10 MB**, plus logo, one-line
   summary, optional website. No structured portfolio questionnaire.
3. **Team profiles are public web pages** (`/t/{teamNumber}`).
4. **A coach is admin-approved before reaching the app.** They fill in the team's profile, deck and
   a FIRST Dashboard screenshot showing their own name on the roster, then send it for review. Until
   it is approved the team can't pitch and has no public page. The checkmark next to a team name now
   means "approved".

   > Superseded 2026-09-16. The original rule let a coach pitch immediately, with verification
   > afterwards — which meant anyone could claim a team number and solicit sponsors in its name.
5. **Company signup is open, but a company is hidden from coaches until an admin approves it.**
   It fills in its profile and questions, sends itself for review, and waits. Approved companies have
   no badge; all visible companies are approved by definition.
6. **Each company defines up to 10 questions** that every pitch to it must answer. If it
   defines none, three default questions apply.
7. **Every pitch is reviewed by an admin before the company sees it.** Admin emails for
   pitches are instant *notifications* that link into the app; the decision happens in the app.
8. **One pitch per team per company per season.** The season runs Sept 1 → Aug 31. Withdrawing
   before the company responds frees the slot; rejection or "not a fit" does not.
9. **Optional ask on each pitch:** an amount, in-kind support, open to discuss, or nothing. **No
   funding caps, reservations, partial offers or ledger.**
10. **Sign-in is Google or a 6-digit email code. No passwords.**
11. **Budget is $0 except the domain.** Free tiers everywhere. Email is capped at 100/day
    (Resend free) and must be queued and quota-aware, and must never fail silently.
12. **The name stays "FTC Pitfund."** The footer carries *"Not affiliated with or endorsed by
    FIRST®."* (Trademark risk was flagged and accepted by Anish.)
13. **Infrastructure is owned by the team account `ftcexodius@gmail.com`**, not by any individual.
    The repo lives in the `ExodiusFTC` GitHub org. Vercel Hobby deploys automatically from `main`.
14. **Fresh database.** Nothing is migrated from v1.

### Non-goals (do not build)

Messaging or threads · appeals · impact reports or fiscal years · analytics charts · funding
caps, capacity, ledger, void-match · sponsor role *tiers*, approvals, second signatures · SSO ·
email-domain rules · admin levels · government IDs or credential documents · password auth ·
MFA · e-signatures · payment tracking · W-9s or receipts · pitching companies not on the
platform · company "programs" · teams browsing other teams · student accounts · dark mode (v1) ·
AI features (v1; architecture must not preclude them) · marketing email campaigns (Anish
recruits sponsors himself).

### Defaults chosen by the planner

- A pitch can be **drafted** immediately, but **submitting** requires the team to have a PDF
  and a one-line summary. The composer says so up front, not at the final click.
- On a match, each side receives the other side's **name, email and optional phone**. For the
  team, that is the coach who submitted plus a link to the team page. For the company, it is
  the member who clicked *Interested*, plus their job title. Nothing else is exposed.
- Every member of a company receives the "new pitch" email.
- The public team page has a **Report** link. The PDF upload requires one checkbox: *"I have
  permission to share any photos of people in this document."*
- Multiple admins are supported (`npm run admin:grant -- email@x.com`).
- Signup-to-team: if the team number already exists on the platform, the coach sees
  "Request to join". Existing members approve. No admin action is needed.

---

## 2. Information architecture

v1 had 46 pages, three sidebars and 11 admin nav items. v2 has **three nav items per
audience, maximum**, a top bar instead of sidebars, and actions happen where the object is.

### Public

| Route | Purpose |
|-------|---------|
| `/` | Landing page: pitch, how it works for both sides, FAQ, CTAs |
| `/t/[number]` | Public team profile: logo, name, number, city/state, verified check, summary, website, PDF viewer, Report |
| `/login` | Google + email code, one page |
| `/legal/terms`, `/legal/privacy` | Rewritten for v2 data practices |
| `/invite/[token]` | Accept a team or company invite |

### Coach (team member)

Top bar: **Pitches** · **Sponsors** · **Team** · (bell) · (account menu)

| Route | Purpose |
|-------|---------|
| `/welcome` | First-run: choose "I coach an FTC team" / "I represent a company", then a short setup |
| `/pitches` | Home. Setup checklist (until complete) + pitch list grouped by state, each row showing the company, status, last event, next step |
| `/pitches/[id]` | Pitch detail: status timeline, the pitch as the sponsor sees it, actions (edit/resubmit, withdraw), contacts when matched |
| `/sponsors` | Directory of approved companies: search, filter by support type, each card showing this team's status with that company |
| `/sponsors/[id]` | Company profile + "Start pitch" / "Continue draft" / status |
| `/sponsors/[id]/pitch` | Pitch composer (autosaving draft) with live "what the sponsor sees" preview |
| `/team` | Edit team profile in place (logo, summary, website, PDF) with a public-page preview; members; join requests; invite |

### Sponsor (company member)

Top bar: **Pitches** · **Company** · (bell) · (account menu)

| Route | Purpose |
|-------|---------|
| `/welcome` | Shared first-run |
| `/inbox` | Home. Pending-approval banner (if pending) + profile checklist; pitch list: New, Interested (matched), Not a fit |
| `/inbox/[id]` | The pitch: team header (logo, verified check, public page link), answers, ask, embedded PDF, **Interested** / **Not a fit** |
| `/company` | Edit company profile, questions (0–10), members, invites (invites only once approved) |

### Admin

Top bar: **Review** · **Directory** · **System** · (account menu). Admins who are also
coaches or sponsors use a workspace switcher in the account menu.

| Route | Purpose |
|-------|---------|
| `/admin` (Review) | One queue with counted tabs: **Pitches** (in review), **Companies** (pending), **Teams** (unverified), **Reports** (open) |
| `/admin/pitches/[id]` | Full-page pitch review (never a thin panel). Left: pitch exactly as the sponsor will see it, with PDF. Right, sticky: team facts (verified?, age, members, prior pitches), company facts, decision actions. Auto-advances to the next item. |
| `/admin/directory` | Search teams, companies and people. Row opens a detail sheet: verify/unverify team, approve/reject/suspend company, suspend team, remove member, grant admin, delete |
| `/admin/system` | Emails today N/100, queued/failed list with retry, storage used, last cron run, recent errors link |

### Shared

`/account`: name, phone (optional, shared only on match), email (read-only), sign out,
delete account. `/dev` and `/dev/ui` exist **only** in local development (see §10).

---

## 3. User journeys and UX state machines

### 3.1 Global feedback contract (applies to every interaction)

These are rules, enforced by shared components, not suggestions.

1. **Acknowledge in ≤100 ms.** Every button that triggers async work uses `ActionButton`. On
   press it immediately shows an inline spinner and a verb label ("Submitting…"), sets
   `aria-busy`, and disables itself to prevent double submits. It is built on
   `useTransition`/`useActionState` and is never a bare `onClick` with no pending state.
2. **Every server action returns a typed `Result`:**
   `{ ok: true, data } | { ok: false, error: { code, message, field? } }`. It never throws to the
   client. `message` is written for humans. `code` drives UI branching (`NOT_FOUND`,
   `FORBIDDEN`, `CONFLICT`, `VALIDATION`, `RATE_LIMITED`, `UNAVAILABLE`, `UNKNOWN`).
3. **Success is visible where the user is looking.** Prefer an in-place state change (row
   status updates, button becomes "Sent ✓"). Use a toast only for things that happen off-screen.
   Never navigate away silently.
4. **Errors appear next to the thing that failed** and preserve all user input. Network
   failures say *"Couldn't reach FTC Pitfund. Check your connection."* with a **Retry** button.
   Validation errors are field-level. Unexpected errors show a short message plus a reference id
   (Sentry event id).
5. **Waiting over 1 s is explained:** the text says what is happening ("Checking FIRST records…",
   "Checking your PDF…"). Over 10 s shows stages. There are no bare spinners.
6. **Route transitions:** every route segment has a `loading.tsx` skeleton that mirrors the
   final layout, so nothing shifts. Links show a pending indicator via `useLinkStatus`.
   Primary nav links prefetch.
7. **Irreversible or outward-facing actions** (submit pitch, Interested, Not a fit, withdraw,
   remove member, delete) use a confirm dialog that states the consequence in one sentence.
   **Exception:** admin decisions on the full-page review screen don't get an extra confirm,
   because the page itself is the deliberate context and speed matters. Reject and Send back
   still require their note dialog. Reversible actions (mark read, save draft) are optimistic.
8. **Background side effects are stated.** When an action queues email, the success state says
   who will be told. If the daily email quota is exhausted, the UI says *"Email delivery is
   delayed until tomorrow. {They} will still see it in FTC Pitfund."* Nothing fails silently.
9. **Empty states teach the next step:** one sentence on what goes here plus the single primary
   action. No illustrations-for-decoration.
10. **Unsaved changes are protected:** forms show "Unsaved changes" and warn before leaving.
    Autosaving forms show "Saving… / Saved · just now / Couldn't save. Retry".
11. **User-generated text never breaks layout:** global `overflow-wrap: anywhere` on user content,
    `min-w-0` on flex children, `whitespace-pre-wrap` for long answers, line clamps with
    "Show more" in lists. A 5,000-character word must not widen any container.

### 3.2 State machines

Legend: **I** idle · **A** acknowledge · **P** processing · **S** success · **E** recoverable error · **X** permanent error.

**Sign in, email code (`/login`)**
- I: email field + "Email me a code"; "Continue with Google" above it.
- A/P: button → "Sending code…".
- S: the view swaps to a code input (single field, `autocomplete="one-time-code"`, accepts paste
  of 6 digits, auto-submits on the 6th). Copy: *"We sent a 6-digit code to {email}. It expires
  in 10 minutes."* Links: "Use a different email" and "Resend code (in 30s)".
- Verifying: "Signing you in…" → redirect to `/welcome` (first time) or role home.
- E: wrong code shows "That code isn't right. Check the latest email." (input keeps focus).
  An expired code offers "Send a new code". Rate limited: "Too many attempts. Try again in N minutes."
  Email send failure: "We couldn't send the email right now. Continue with Google, or try again in a few minutes."
- Google: button → "Opening Google…", then return to `/auth/callback` → redirect.
  Cancel/denied shows the login page with "Google sign-in was cancelled."

**Coach first run (`/welcome` → team)**
- Choose "I coach an FTC team".
- Team number field. On 4+ digits, a debounced (400 ms) lookup starts.
  - P: "Checking FIRST records…" (inline, the field stays editable)
  - Found: card "**Team 31579 · Exodius** · Austin, TX. Is this your team?" [Yes]
  - Not found: "No FTC team 12345 in FIRST records. Check the number, or continue and enter
    the name and city yourself."
  - FIRST/FTCScout unavailable: "FIRST records aren't reachable right now. Enter your team
    name and city; we'll check them later." (sets `needs_record_check`)
  - Already on Pitfund: card with logo/name + "This team is already on FTC Pitfund. **Request to
    join**" → creates join request → S: "Request sent to the team's coaches. We'll email you
    when they respond." (a waiting screen with "Cancel request").
- Confirm: "I'm 18 or older and I coach or mentor this team" + accept Terms (both required,
  one checkbox each) → "Create team" (ActionButton) → `/pitches` with the setup checklist.

**PDF upload (`/team`)**
- I: drop zone "Upload your sponsorship deck: PDF, up to 5 pages and 10 MB", plus the permission checkbox.
- A (client, instant): type, size and page-count check in the browser via pdf.js *before*
  uploading. Too many pages → "This PDF has 8 pages. The limit is 5." Not a PDF or corrupt →
  "This file isn't a readable PDF."
- P1 Uploading: a real progress bar ("Uploading 2.1 of 4.3 MB") with **Cancel**.
- P2 "Checking your PDF…": the server re-verifies magic bytes, pages ≤5, size ≤10 MB.
- P3 "Creating preview…": the page-1 thumbnail (rendered in the browser before upload) is saved.
- S: new thumbnail + "Deck updated · visible on your public page"; the old file is deleted.
- E: network drop → "Upload interrupted." [Retry] (keeps file). Server rejection shows the exact reason.
- Cancel → back to I, staging object cleaned up by the daily cron.

**Pitch composer (`/sponsors/[id]/pitch`)**
- Entry: if the team lacks a PDF or summary, a top notice links to `/team`. Drafting is allowed,
  but Submit stays disabled with the reason shown next to it.
- Editing: the company's questions (or defaults), each a textarea with an optional max-length
  counter shown at 80% of the limit (2,000 chars each). **No minimum lengths.** Required
  questions are marked. Below that is the optional ask (segmented: No ask · Amount · In-kind ·
  Open to discuss) plus an amount or note field.
- Autosave: 1 s debounce → "Saving…" → "Saved · just now". Failure → "Couldn't save. Retry"
  (local copy kept in `sessionStorage` until saved).
- Preview toggle (desktop: side-by-side; mobile: tab) shows exactly the sponsor view.
- Submit → confirm dialog: *"Send this pitch to {Company} for review? A Pitfund reviewer reads
  every pitch before it reaches {Company}, usually within a day. You can't edit it while it's
  in review."* → P "Submitting…" → S redirect to `/pitches/[id]` with the status "In review"
  and a timeline entry.
- E: a required question is empty → the field is focused with "Answer this question to submit".
  Season conflict (race) → "You've already pitched {Company} this season." with a link.

**Admin review (`/admin/pitches/[id]`)**
- Actions: **Approve & send** · **Send back** (note required) · **Reject** (note optional;
  shown to the coach if present).
- Keyboard: `A`, `S`, `R`; `J`/`K` next/previous in the queue.
- P: the button shows its pending state. S: a toast "Sent to {Company} · {n} people notified"
  (or "…email delayed until tomorrow"), then auto-advance to the next item. Queue empty →
  "You're all caught up."
- E: already decided by another admin (conflict) → "{Admin} already {decided} this pitch" + reload.

**Sponsor response (`/inbox/[id]`)**
- **Interested** → confirm: *"We'll share your name, title and email with {Team}, and theirs
  with you. You'll take it from there."* → P → S: the page shows a "Connected" panel with the
  team contact (name, email, phone if provided) and "We emailed you both."
- **Not a fit** → dialog with an optional reason (short list + free text) → S: "Marked not a
  fit. {Team} has been notified." → back to the inbox with the row moved.
- E: withdrawn meanwhile → "{Team} withdrew this pitch." (read-only).

**Coach withdraw** → confirm → S: status "Withdrawn", and the slot frees for the season.
Allowed while `in_review`, `changes_requested` or `sent`.

**Invite member (team or company)** → email field → "Send invite" → S: the row appears under
"Invited" with "Resend" and "Revoke". The invite is bound to that email: the person must sign
in with that address (Google or code). Expires in 14 days. E: already a member / invalid email.

**Join request (team)** → members see a banner on `/team` and a bell notification: "Jane Doe
(jane@…) wants to join" → Approve / Decline → requester emailed.

**Company approval (admin)** → Approve → the company appears in the directory instantly; members
are emailed *"You're approved. Teams can now pitch {Company}."* Reject (note) → members are
emailed with the note and the support email.

### 3.3 Pitch lifecycle

```
draft ──submit──▶ in_review ──approve──▶ sent ──interested──▶ matched
  ▲                  │  │                   └──not a fit──▶ declined
  └──edit/resubmit◀──┘  └──reject──▶ rejected
changes_requested ◀── send back
withdrawn ◀── coach, from in_review | changes_requested | sent
```

Coach-facing labels: Draft · In review · Needs changes · Not approved · Sent · Matched · Not
a fit · Withdrawn. Sponsors only ever see `sent`, `matched` and `declined` pitches (and a
read-only withdrawn notice if they had it open).

---

## 4. Data model (fresh schema, Drizzle)

All ids are `uuid`. All tables have `created_at timestamptz default now()`. Mutable tables have
`updated_at`. RLS is **enabled with zero policies** on every table, so the Supabase REST API
exposes nothing to `anon`/`authenticated`; all access goes through the server.

```
users              id (= auth.users.id) PK, email, name, avatar_url, phone?, job_title?, is_admin bool,
                   accepted_terms_at, suspended_at?
teams              id, number int UNIQUE, name, city, state, country, website?, summary (≤160),
                   logo_path?, pdf_path?, pdf_pages?, pdf_bytes?, pdf_thumb_path?, pdf_updated_at?,
                   media_consent_at?, record_status ('matched'|'manual'|'unchecked'),
                   verified_at?, verified_by?, suspended_at?
team_members       team_id, user_id  PK(team_id,user_id); UNIQUE(user_id) (one team per user)
team_join_requests id, team_id, user_id, status ('pending'|'approved'|'declined'|'cancelled'),
                   decided_by?, decided_at?; UNIQUE(team_id,user_id) WHERE status='pending'
sponsors           id, name, website, logo_path?, city?, state?, region? (free text),
                   about? ("what we look for"), support_types text[]
                   (funding|equipment|software|mentorship|other),
                   questions jsonb ([{id, prompt ≤200, help? ≤300, required bool}], ≤10),
                   status ('pending'|'approved'|'rejected'|'suspended'), status_note?,
                   decided_by?, decided_at?,
                   applicant_title?, applicant_linkedin?
sponsor_members    sponsor_id, user_id  PK; UNIQUE(user_id)
invites            id, kind ('team'|'sponsor'), team_id?, sponsor_id?, email, token_hash UNIQUE,
                   invited_by, expires_at, accepted_at?, revoked_at?; CHECK exactly one org id
pitches            id, team_id, sponsor_id, season int (start year), status (enum above),
                   answers jsonb ([{questionId, prompt, answer}] snapshot),
                   ask_type ('none'|'amount'|'in_kind'|'open'), ask_amount_cents?, ask_note?,
                   created_by, submitted_by?, submitted_at?, review_note?, reviewed_by?,
                   reviewed_at?, sent_at?, responded_by?, responded_at?, decline_reason?,
                   team_contact jsonb?, sponsor_contact jsonb? (snapshots at match)
                   UNIQUE(team_id,sponsor_id,season) WHERE status <> 'withdrawn'
audit_events       id, actor_id?, action, entity_type, entity_id, data jsonb
                   (also powers the pitch timeline)
notifications      id, user_id, type, title, body?, href?, read_at?
email_outbox       id, to_email, template, payload jsonb, priority smallint
                   (0 auth, 1 transactional, 2 admin instant, 3 digest),
                   status ('queued'|'sending'|'sent'|'failed'|'bounced'),
                   attempts, last_error?, resend_id?, dedupe_key UNIQUE?, send_after, sent_at?
reports            id, team_id, reporter_user_id?, reporter_email?, reason, details?,
                   status ('open'|'resolved'), resolved_by?, resolved_at?
ftc_team_cache     number PK, name, city, state, country, source ('first'|'ftcscout'), fetched_at
cron_runs          id, job, started_at, finished_at?, ok bool?, detail jsonb
```

Indexes: `pitches(sponsor_id,status)`, `pitches(team_id,status)`,
`pitches(status,submitted_at)`, `notifications(user_id,read_at,created_at desc)`,
`email_outbox(status,priority,send_after)`, `audit_events(entity_type,entity_id,created_at)`,
`teams(verified_at)`, `sponsors(status)`, trigram or `ilike` search indexes on
`teams.name`/`sponsors.name` if needed.

Season helper: `pitchSeason(date) = month >= 9 ? year : year - 1`; labelled `2026–27`. (The
FIRST API's own `season` path parameter uses a different, May-based boundary. That lives in a
separate `firstApiSeason()` helper; do not conflate them.)

Default questions (used when `sponsors.questions` is empty):
1. "Why are you reaching out to {Company} specifically?" (required)
2. "What would {Company}'s support make possible for your team this season?" (required)
3. "Do you have any connection to {Company}: employees, parents, location, or events?" (optional)

---

## 5. Technical architecture

### Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 16 App Router**, React 19, TypeScript strict | Vercel-native, streaming RSC, server actions, `after()`, well known by agents. **Read `node_modules/next/dist/docs/` before writing Next code:** `middleware.ts` is now `proxy.ts`; caching uses `use cache`/`cacheTag` |
| Hosting | **Vercel Hobby**, Git-connected to `ExodiusFTC/FTC-Pitfund-Source-Code`, region `iad1` | $0. Donations are explicitly not commercial use (Vercel fair-use page, 2026-07-29) |
| DB | **Supabase Postgres (free)**, `us-east-1` (co-located with `iad1`) | Existing familiarity, free, local stack via CLI |
| ORM/migrations | **Drizzle ORM + drizzle-kit**, `postgres` driver (`prepare: false` on the transaction pooler, port 6543) | Typed schema in TS, generated migrations, applied by script, no hand-written SQL |
| Auth | **Supabase Auth**: Google OAuth + email OTP (6 digits) via `@supabase/ssr` cookies | Removes Clerk and the identity bridge; free to 50k MAU; local Mailpit captures codes |
| Auth emails | Supabase **Send Email hook** (HTTP, free plan) → `/api/auth/send-email` → email outbox (priority 0) | Branded "FTC Pitfund" emails through the same quota-aware sender |
| Authorization | Server-only permission module (`lib/server/authz.ts`) + data module (`lib/server/data/*`) | One layer, unit-tested; lint-enforced that nothing else imports the DB |
| Files | **Supabase Storage** (public bucket `public`, private bucket `staging`), direct browser upload via signed upload URL | Progress bar, no function body limits; one `lib/server/storage.ts` so an R2 swap is one file |
| PDF | `pdfjs-dist` (client: page count, thumbnail, viewer, lazy-loaded) + `pdf-lib` (server: verification) | No server-side rendering cost |
| Email | **Resend (free)** + React Email templates + `email_outbox` table | Quota-aware, prioritized, retried, visible |
| Jobs | Vercel cron (Hobby: max 2 jobs, once/day, fires within the hour) → `/api/cron/daily` at `0 13 * * *` | Drain outbox, admin digest, clean staging, keep Supabase awake, record `cron_runs` |
| UI | Tailwind v4 + **shadcn/ui on Radix only** (no base-ui), lucide icons, Inter via `next/font` | One primitive family, consistent |
| Forms | react-hook-form + zod (shared schemas client/server) | |
| Errors | Sentry (free, team-owned), PII scrubbed | Errors never silent |
| Bot protection | Vercel BotID (free) on the email-code request and the report form | No CAPTCHA account |
| Tests | Vitest (unit/integration against local Postgres), Playwright (E2E, visual QA, axe) | Agent-runnable |
| CI | GitHub Actions: typecheck, lint, unit, E2E against `supabase start` | Free org minutes |

**Removed dependencies:** `@clerk/*`, `svix` (unless Resend's webhook verification still needs it; check),
`@base-ui/react`, `@tiptap/*`, `recharts`, `cmdk`,
`swr`, `react-easy-crop`, `isomorphic-dompurify` (no user HTML is rendered in v2),
`framer-motion` (CSS transitions suffice), `next-themes`, `@react-email/*` duplicates as appropriate.

### Module layout

```
app/
  (public)/ page.tsx, t/[number]/, login/, legal/, invite/[token]/
  (app)/    layout.tsx (top bar, role-aware), welcome/, pitches/, sponsors/, team/,
            inbox/, company/, account/
  admin/    layout.tsx, page.tsx, pitches/[id]/, directory/, system/
  dev/      page.tsx (persona switcher), ui/page.tsx (state gallery)   ← local only
  auth/callback/route.ts
  api/ auth/send-email, cron/daily, webhooks/resend, health
lib/
  server/   db.ts (drizzle client), schema.ts, authz.ts, viewer.ts (React cache()),
            data/{teams,sponsors,pitches,invites,notifications,reports,admin}.ts,
            email/{outbox.ts,send.ts,templates/*}, storage.ts, ftc-records.ts, audit.ts,
            result.ts (Result type + error codes), env.ts
  shared/   season.ts, schemas/*.ts (zod), labels.ts, format.ts
  client/   use-action.ts, upload.ts, pdf.ts
components/ ui/ (primitives), app/ (shell, nav, bell), feature folders
drizzle/    generated migrations
scripts/    setup.ts, seed/{index.ts,scenarios/*}, admin-grant.ts, provision/*
tests/      unit/, e2e/, qa/
proxy.ts    Supabase session refresh only; no role logic
```

### Request and auth flow

- `proxy.ts` refreshes the Supabase session cookie (per the `@supabase/ssr` Next.js guide) and does nothing else.
- `getViewer()` (wrapped in React `cache()`) reads the session once per request and loads
  `users` + team or sponsor membership in **one query**. Layouts and pages call it; no repeated auth round-trips.
- Route guards live in segment layouts: `(app)` requires a viewer and redirects to `/welcome`
  if they have no org; `admin` requires `is_admin`; pages call the specific `authz` guard.
- Server actions: validate (zod) → `authz` guard → data function (transaction where multiple
  writes) → `audit()` → `notify()` (in-app rows written in the same transaction) →
  `after(() => drainOutbox())` → `revalidateTag`/`revalidatePath` → `Result`.
- Suspended users, teams and companies are blocked inside `authz`, not per page.

### Caching and freshness

| Data | Strategy |
|------|----------|
| Landing | Static |
| `/t/[number]` | Cached per team with `cacheTag('team:{id}')`; invalidated on team update, verify or suspend |
| Sponsor directory (coach) | Cached with `cacheTag('sponsors')`; invalidated on company approve or update. The per-team status overlay is a separate uncached query |
| Authed dashboards, inbox, admin | Dynamic, no cache; data functions run queries in parallel (`Promise.all`) |
| FTC records | `ftc_team_cache` table, TTL 30 days; FIRST API primary if credentials exist, else FTCScout |
| Notification badge | Computed in the layout query; refreshed on navigation and `router.refresh()` on window focus. **No polling** |

Nothing in the product needs realtime. Admin review is a queue the admin works through.

### Email outbox (never silent)

- `enqueueEmail({ to, template, data, priority, dedupeKey })` inserts a row, usually inside the
  same transaction as the state change, then the action schedules `after(drainOutbox)`.
- `drainOutbox()` claims rows with `FOR UPDATE SKIP LOCKED`, ordered by `priority, created_at`,
  where `send_after <= now()`.
- **Quota:** count `sent` rows in the last 24 h. Budgets: priority 0 (auth) may always use the
  full 100. Priorities 1–2 stop at 90. Priority 3 (digest) stops at 70. Rows over budget get
  `send_after = oldest_sent_in_window + 24h`.
- Resend `idempotencyKey = outbox.id`. 429/5xx → exponential backoff, max 5 attempts → `failed`.
  4xx validation → `failed` immediately.
- `/api/webhooks/resend` (signature verified) marks `bounced`/`complained`.
- The in-app notification is written regardless of email, so email is always a copy, never
  the only channel.
- Admin **System** page shows usage, queued, failed (with Retry) and bounced. Toasts and
  timelines report "email delayed" when relevant.
- The Send Email hook handler must respond within Supabase's hook timeout. It enqueues at
  priority 0 and sends synchronously.

### Files

- `public` bucket: `teams/{teamId}/logo-{uuid}.webp`, `teams/{teamId}/deck-{uuid}.pdf`,
  `teams/{teamId}/thumb-{uuid}.webp`, `sponsors/{sponsorId}/logo-{uuid}.webp`. Unguessable
  names; replaced objects are deleted.
- `staging` bucket (private): uploads land here via `createSignedUploadUrl`. `finalizeUpload`
  verifies on the server and moves the object into `public`. The cron deletes staging objects older than 24 h.
- Logos: client-side resize to 512 px WebP before upload (canvas), max 2 MB source.
- Storage usage = `SUM(pdf_bytes)` + logo sizes tracked in DB, shown on System. **Egress
  watch:** the Supabase free tier has 5 GB/month; the System page links to the Supabase usage
  dashboard, and the plan for overflow is Cloudflare R2 behind `storage.ts`.

### External services and failure modes

| Service | Timeout | Failure behavior |
|---------|---------|------------------|
| FIRST API / FTCScout | 4 s each, sequential fallback | Manual entry path; `record_status='unchecked'`; cron rechecks unchecked teams |
| Resend | 10 s | Outbox retry/backoff; UI says delayed; System shows failures |
| Supabase Storage | client upload with retry | Resumable retry button keeps the file in memory |
| Supabase Auth (Google) | provider | Login page shows cancel/error message + email-code alternative |
| Sentry | fire-and-forget | Never blocks requests |

### Security

- Service-role key only in `lib/server/*` (`server-only`). Anon key only used for auth and
  signed uploads. RLS enabled with no policies on all public tables.
- An ESLint `no-restricted-imports` rule bans `lib/server/db`, `drizzle-orm` and the Supabase
  admin client outside `lib/server/**` and `scripts/**`.
- Every data function takes the viewer and checks membership. Unit tests prove a sponsor member
  can't read another company's pitches, a coach can't read another team's drafts, and
  pending/suspended companies are invisible to coaches.
- Contact details are only returned for `matched` pitches, to members of the two orgs involved.
- Invite tokens: 32 random bytes, only the SHA-256 is stored, bound to the email, 14-day expiry, single use.
- Uploads are verified server-side (magic bytes, page count, size). PDFs are served as
  `application/pdf` from the storage domain, never inlined into the app origin's HTML.
- Security headers via `next.config`: HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and a CSP allowing Supabase, Google, Sentry and Vercel BotID.
- `/dev/*` routes: `notFound()` unless `NODE_ENV !== 'production'` **and** the Supabase URL
  host is `127.0.0.1`/`localhost`. An E2E test asserts a production build returns 404.
- Audit every admin action and every org membership change in `audit_events`.

---

## 6. Performance strategy

**Budgets (acceptance-tested):**
- Click to visible acknowledgement: ≤100 ms (the button pending state is synchronous).
- Landing and `/t/[number]`: TTFB ≤300 ms on Vercel (static/cached); LCP ≤2.0 s on
  Lighthouse mobile "Slow 4G"; CLS ≤0.05.
- First-load JS ≤170 KB gzipped per route (the pdf.js viewer is excluded and lazy-loaded on interaction or visibility).
- Authed page server render ≤400 ms p95 locally against the pooled DB. ≤5 DB queries per page,
  no sequential awaits of independent queries.
- Server actions ≤500 ms p95, excluding email (always `after()`).
- No layout shift from skeleton to content.

**Tactics:** one `getViewer()` query per request; `Promise.all` for independent reads; tagged
caching of public pages and the directory; prefetch primary nav; skeletons per segment; direct
browser uploads; client-side PDF pre-checks before any network; `after()` for email and audit
fan-out; no scroll-reveal animations that hide content; `next/font` Inter with `display:swap`;
`next/image` for logos (Supabase storage domain configured).

---

## 7. UI system

Reference level of polish: Stripe/Linear-quality restraint. **Do not copy their branding.**

This is a **full product UI/UX replacement**, not a restyle of the current v1 screens. Every
user-facing route, state, form, table, empty state, dialog, email, and mobile interaction must
be redesigned to use this system. Do not carry forward v1 layout patterns, visual shortcuts,
placeholder styling, dense card grids, arbitrary colors, or unfinished-looking panels. The
finished product should feel light, white, calm, precise, and premium: strong typography,
generous whitespace, clear hierarchy, restrained borders, excellent alignment, and one obvious
next action per view. “It works” is not a visual acceptance criterion.

**Principles:** one primary action per view; hierarchy by type and spacing, not boxes; borders
over shadows; very few cards (lists and sections with dividers instead); no gradients, no
decorative illustrations, no background patterns; badges only for status, and small.

**Tokens (CSS variables, Tailwind v4 `@theme`):**
- Type: **Inter**, tabular numerals where numbers align. Scale (px/line-height): 12/16 caption,
  13/20 small, **14/22 body**, 16/24 lead, 20/28 h3, 24/32 h2, 30/38 h1; landing display 44/52 and 56/64. Weights: 400, 500, 600.
- Color, light theme only:
  canvas `#FAFAFA`, surface `#FFFFFF`, border `#E7E7EA`, border-strong `#D4D4D8`,
  text `#0B0B0C`, text-secondary `#52525B`, text-tertiary `#71717A`,
  **accent `#1F6F5C`** (pine; ≥4.5:1 on white), accent-hover `#185A4B`, accent-subtle `#EAF3F0`,
  success `#15803D`, warning `#B45309`, danger `#B91C1C`, info `#1D4ED8` (each with a `-subtle` background).
  Focus ring: 2 px accent with a 2 px offset, always visible on keyboard focus.
- Space: 4 px grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96).
- Radius: 6 px controls, 8 px menus/popovers, 12 px dialogs/sheets and media. Nothing pill-shaped except avatars and status dots.
- Elevation: none on in-flow content; `shadow-sm` on menus; `shadow-lg` on dialogs/sheets only.
- Motion: 120 ms hover/press, 180 ms overlays (fade + 4 px translate), `prefers-reduced-motion` disables transforms.

**Layout:**
- Top bar 56 px: wordmark "FTC Pitfund", 2–3 nav items, bell, avatar menu.
- Content widths: app max 1080 px, forms 640 px, reading 720 px, admin review 1280 px.
- Page header pattern: title (h1 24 px), one-line description, primary action right-aligned
  (stacks on mobile).
- Mobile (<640 px): nav collapses into a bottom-anchored menu sheet; tables become stacked lists; composer preview becomes a tab.

**Components** (build in `components/ui`, each shown in every state on `/dev/ui`):
Button (primary, secondary, ghost, danger; sizes sm/md; loading), ActionButton, IconButton
(requires `aria-label`), Input, Textarea (auto-grow, counter), Select, Checkbox, RadioCards,
SegmentedControl, FileDrop (with progress), Field (label, hint, error), Form section, Avatar
(image → initials), TeamMark (logo + name + verified check), StatusBadge (dot + label),
Timeline, EmptyState, Skeleton set, Toast (sonner, styled), Banner (info/warning/danger), Tabs,
Table (desktop) / List (mobile), Menu, Popover, Tooltip, **Dialog**, **Sheet**, ConfirmDialog,
PdfViewer (lazy), Pagination, SearchInput, KeyboardHint.

**Overlay system (fixes the v1 thin-panel bug class):**
- `Dialog` sizes: `sm` 400 px, `md` 560 px, `lg` 720 px; `width: min(size, 100vw - 32px)`;
  `max-height: min(85vh, 100dvh - 32px)`; the header (title + close) and footer (actions) stay
  sticky while only the body scrolls.
- `Sheet` (right side): `width: min(640px, 100vw)`; full screen below 640 px; the same sticky
  header/footer structure.
- **Rule:** anything with more than a short form or a paragraph of content is a **page**, not an
  overlay. Pitch review, company review and team review are pages.
- All overlays: focus trap, `Esc` closes, return focus to the trigger, scroll lock, a visible close button, an `aria-labelledby` title.
- A Playwright QA check fails if any overlay's content box is narrower than 320 px at desktop
  width, if text overflows its container, or if the page scrolls horizontally.

**Copy voice:** plain, specific, second person, no jargon ("dispatch", "submission", "RLS",
"token" never appear in UI). Status labels from §3.3. Buttons are verbs.

**Visual quality bar:** before a route is considered complete, inspect it at 375, 768, and
1280 px with realistic, empty, loading, error, long-content, and populated data. Fix weak
hierarchy, crowded or dead space, inconsistent spacing, misaligned baselines, excessive
containers, awkward wrapping, low-information empty states, unclear actions, cheap-looking
defaults, and any visible v1 residue. Use real product content and imagery where imagery is
needed; never use fake decorative UI to make a page appear finished.

---

## 8. Reliability strategy

- **Idempotent actions:** submit, decide and respond check the current status inside the
  transaction (`UPDATE … WHERE status = expected RETURNING`). Zero rows → `CONFLICT` with a
  human message. Double-clicks are also prevented by ActionButton.
- **Uniqueness enforced in the DB** (season rule, one org per user, pending join request), mapped
  to friendly `CONFLICT` messages.
- **Email:** outbox with retry, quota and visibility (§5). In-app notification is always written.
- **External lookups** degrade to manual entry, never block signup.
- **Supabase free pausing:** the daily cron touches the DB. `/api/health` checks the DB.
- **Error boundaries** per route segment with "Try again" and a Sentry event id; a global
  `not-found`.
- **Cron** records `cron_runs`. System shows the last success. A missed run (>36 h) shows a warning on System.
- **Backups:** Supabase free has none. `npm run db:backup` (pg_dump via `DATABASE_URL` to a
  gitignored `backups/` directory, plus storage object listing) exists for manual or scheduled local runs.

## 9. Scalability strategy

- **Stateless** Vercel functions; Postgres via the transaction pooler; no in-memory state
  (v1's per-instance throttles are gone).
- **Indexed queries** (§4); list pages paginate (cursor on `created_at,id`, 25 per page).
- **Free-tier ceilings and the upgrade path:**
  - Resend 100/day → Pro ($20/mo) when System shows sustained ≥80.
  - Supabase 500 MB DB / 1 GB storage / 5 GB egress → Pro ($25/mo), or R2 for files.
  - Vercel Hobby limits (1M invocations, 4 CPU-h) are far away.
- The System page shows each ceiling as "used / limit" so the team knows when to pay.
- **Growth features stay possible without a rewrite:** AI assist (pitch drafting from the PDF)
  plugs into the composer and a new server action; more cron jobs fit the dispatcher route;
  moving files to R2 is `storage.ts`.

## 10. Development, testing and QA automation

**Principle: Anish does not click through the app to test it, paste SQL, or set up
accounts for testing. Agents do all of it with commands.**

| Command | Does |
|---------|------|
| `npm run setup` | Verifies Docker, runs `supabase start`, writes `.env.local` from `supabase status -o env` (never overwriting prod values), migrates, seeds `demo` |
| `npm run dev` | Next dev server |
| `npm run db:generate` | drizzle-kit generate from `lib/server/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (refuses a non-local host unless `--remote` and `CONFIRM_REMOTE=1`) |
| `npm run db:reset` | Local reset → migrate → seed (`--scenario` optional) |
| `npm run seed -- --scenario demo\|empty\|edge` | Idempotent fixtures |
| `npm run admin:grant -- email` | Make a user admin (local or `--remote`) |
| `npm run check` | typecheck + lint + unit tests |
| `npm run e2e` | Playwright journeys against local stack |
| `npm run qa` | Visual/UX sweep (below) |
| `npm run db:backup` | pg_dump to `backups/` |

**Seed scenarios:**
- `demo`: 10 teams (mixed verified/unverified, with logos, PDFs and summaries), 8 approved
  companies + 2 pending + 1 rejected, 30 pitches covering **every** status, notifications,
  join requests, invites, an outbox with sent/queued/failed rows.
- `empty`: users exist but have no content (tests first-run and empty states).
- `edge`: 5,000-char unbroken strings in every free-text field, 10-question company, 60-char
  team names, a max-size 5-page PDF, email quota exhausted (95 sent in 24 h), a failed and a
  bounced email, a suspended team, a withdrawn pitch.

**Personas** (fixed emails `*@pitfund.test`): `admin`, `coach-new` (no team), `coach` (verified
team with pitches), `coach-unverified`, `coach-joiner` (pending join request), `sponsor-new` (no
company), `sponsor-pending`, `sponsor` (approved, with inbox), `sponsor2` (another company, for
isolation tests).

**`/dev` persona switcher (local only):** one click signs in as any persona (server uses the
Supabase admin API to generate and verify a magic-link OTP, which sets the cookie) and lands on
that persona's home. It also offers **Reset data** (runs the scenario reseed) and a link to
Mailpit (`http://127.0.0.1:54324`).

**`/dev/ui` state gallery:** every component in every state (idle, hover, focus, loading,
success, error, disabled, empty, long content) on one page for visual QA.

**Tests:**
- **Unit/integration (Vitest):** authz matrix (every guard × persona); season rule;
  pitch transitions (legal and illegal); outbox quota/priority/backoff (fake clock, mocked
  Resend); PDF verification; invite token flow; FTC record fallback; Result mapping of DB errors.
  Integration tests run against the local Postgres, each in a transaction rolled back after.
- **E2E (Playwright), signed in via persona fixtures (no UI login except in the login tests):**
  1. Email-code login, reading the code from the Mailpit API; the Google button renders.
  2. Coach new: welcome → team lookup → create → upload PDF → summary → directory → compose →
     autosave → submit → status In review.
  3. Admin: queue → review → send back with note → coach resubmits → admin approves → sponsor
     sees it (and the email is in Mailpit).
  4. Sponsor: inbox → Interested → contacts visible to both sides; the other pitch → Not a fit.
  5. Season rule: a second pitch to the same company is blocked; withdraw frees it.
  6. Join request approve/decline; invite accept (email-bound, wrong email rejected).
  7. Sponsor pending is invisible to coaches; approval makes it visible.
  8. Isolation: `sponsor2` gets 404 on `sponsor`'s pitch URLs; coach gets 404 on another team's draft.
  9. Public team page renders the PDF viewer; Report submits; a suspended team returns 404.
  10. Email quota exhausted → UI shows the delayed message; System shows queued.
  11. `/dev` returns 404 in a production build.
- **`npm run qa` (the UX gate):** for every route × every relevant persona × viewports
  **375, 768, 1280**, Playwright:
  - saves a full-page screenshot to `qa/screens/{route}/{persona}-{width}.png`
  - fails on any console error, failed request (≥400 except expected 404 tests) or uncaught exception
  - fails on horizontal overflow (`scrollWidth > clientWidth`) and on any element whose text overflows its box
  - runs axe and fails on serious/critical violations (after animations settle)
  - opens every dialog/sheet trigger on the page and checks overlay width ≥320 px (desktop), a sticky close control and a focus trap
  - records TTFB/LCP/CLS per page into `qa/report.json` and fails budgets from §6
  - clicks every `ActionButton` in the `/dev/ui` gallery and asserts a pending state appears within 100 ms
  - writes `qa/report.md` summarizing failures with screenshot paths

  **Agents must open and look at the screenshots** (or use a browser tool such as
  chrome-devtools MCP or Antigravity's browser) and judge the visual quality against §7, not
  just the pass/fail. The `edge` scenario is run through `qa` too.
- **CI:** `.github/workflows/ci.yml` runs `check`, then `supabase start` → migrate → seed → `e2e`
  on every PR and push to `main`.

## 11. Migration and replacement strategy

- Tag the current `main` as `legacy-v1` and push the tag. Create branch `rebuild`. All four
  prompts work on `rebuild`; prompt 4 merges to `main` once acceptance passes.
- **Delete** v1 code wholesale: `app/`, `components/`, `lib/`, `emails/`, `hooks/`,
  `supabase/migrations/`, `supabase/seed.sql`, `supabase/snippets/`, `tests/`, `scripts/`,
  `middleware.ts`, `instrumentation*.ts` (recreated), `knip` config if obsolete,
  `prompts/revamp/`, `prompts/audits/`, and all of `docs/` except what prompt 4 rewrites.
  Git history and the tag preserve everything.
- **Carry over as reference (port, don't copy blindly):** the FIRST Events API client and
  FTCScout fallback logic (`lib/first-api.ts`, `lib/ftc-roster.ts` in `legacy-v1`, noting the
  FTCScout `location {}` schema fix); legal page text as a starting point for rewrites;
  the brand accent `#1F6F5C`.
- **Rewrite:** `CLAUDE.md`, `.claude/rules/*`, `.claude/agents/*` (the v1 agents reference
  Clerk/RLS and must be replaced or deleted), `prompts/_NEXT-SESSION.md`, `README.md`, `docs/LAUNCH.md` (new single launch doc), `docs/RUNBOOK.md`.
- **Production data:** none is migrated. The v1 Supabase project, Clerk instance and personal
  Vercel/Resend accounts are retired after launch on the new team-owned accounts (prompt 4
  documents the decommission steps; do not delete anything in production without Anish's go-ahead).
- **Support email:** `ftcexodius@gmail.com` (v1's `exodiusftc@gmail.com` is stale).

## 12. Acceptance criteria (the rebuild is done only when all are true)

**Product**
- [ ] A new coach goes from landing page to a submitted first pitch in under 5 minutes in the E2E timing test (excluding typing time: the steps count ≤ 8 screens).
- [ ] A new sponsor goes from signup to a completed profile with questions in under 3 minutes (≤ 4 screens).
- [ ] The admin approves a pitch from the notification email in 2 clicks (email link → Approve & send).
- [ ] Every rule in §1 "Core rules" is implemented and covered by a test.
- [ ] No non-goal from §1 exists in the codebase.

**UX**
- [ ] `npm run qa` passes on `demo` and `edge` with zero failures at 375/768/1280.
- [ ] Every async action shows pending state ≤100 ms; every error is human-readable with a next step; no bare spinners.
- [ ] Every state machine in §3.2 is implemented, including its error branches (verified in E2E or `/dev/ui`).
- [ ] No text overlap, clipping or horizontal scroll anywhere, including with 5,000-char words.
- [ ] Every overlay follows §7's overlay system; no content-heavy overlays.
- [ ] The agent has personally reviewed every screenshot in `qa/screens` and fixed anything that looks unfinished.

**Engineering**
- [ ] `npm run check`, `npm run e2e` and `npm run qa` are green locally and in CI.
- [ ] `npm run build` is green; first-load JS budgets met; Lighthouse mobile ≥90 performance and ≥95 accessibility on `/`, `/t/[number]` and `/login`.
- [ ] Fresh clone → `npm install && npm run setup && npm run dev` works with no manual steps beyond having Docker running.
- [ ] Lint rule prevents DB access outside `lib/server`. The authz test matrix passes.
- [ ] Email outbox: quota, priority, retry and bounce paths are tested; System shows them.
- [ ] `/dev/*` 404s in production builds.
- [ ] No dependency from the removed list remains; `knip` reports no unused files or dependencies.
- [ ] Docs rewritten: `CLAUDE.md`, `.claude/rules/*`, `docs/LAUNCH.md`, `docs/RUNBOOK.md`, `prompts/_NEXT-SESSION.md`.

**Launch readiness**
- [ ] `scripts/provision` automates everything the Supabase, Vercel, Resend and GitHub CLIs/APIs allow. `docs/LAUNCH.md` lists only the steps that require a human (account creation under `ftcexodius@gmail.com`, Google OAuth client, domain purchase and DNS, billing) with exact values to paste.
