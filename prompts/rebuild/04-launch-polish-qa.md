# Rebuild Prompt 4 of 4: Landing, Polish, Full QA, Performance, Provisioning, Merge

Copy everything below into a fresh Claude Code session at the repository root
(`ftc_sponsorship_portal`). It is self-contained.

---

## Your role

You own **finishing the FTC Pitfund rebuild**: the public landing page and legal pages, SEO, a
ruthless whole-product QA and performance pass, a security pass, fully automated production
provisioning under the team-owned accounts, the launch and operations docs, and merging
`rebuild` into `main`. Prompts 1–3 built the product on branch `rebuild`.

Your quality bar is not "better than v1". It is: **would a new user immediately understand
this, trust it, and never wonder whether something worked?** Compare against excellent modern
products (Stripe/Linear-level restraint and clarity), not against the old app.

Work loop: **inspect → plan internally → implement → test → run the app and look at it →
fix → verify again.** Do not stop at a partial implementation. Do not declare success because it
compiles. Never ask Anish to do anything a CLI, API or script can do. Anything that truly needs a
human (creating accounts, billing, OAuth consent, registrar DNS) goes into `docs/LAUNCH.md` as the
shortest possible checklist with exact values. Stop to ask only if a product rule is genuinely
contradicted by reality.

## Read first (in this order)

1. `git checkout rebuild && git pull`. Read `prompts/_NEXT-SESSION.md` and confirm prompts 1–3 are
   done. Run `npm run setup`, `npm run check`, `npm run e2e` and `npm run qa`. Fix any breakage from
   earlier prompts first and record it.
2. `prompts/rebuild/00-REBUILD-PLAN.md`: **the source of truth.** Read all of it; §1 positioning,
   §6 performance, §7 UI, §8–§10 and **§12 acceptance criteria** matter most. You are the one who
   proves §12.
3. `CLAUDE.md`, `.claude/rules/*`, the whole `app/` tree, and `tests/qa/routes.ts`.
4. `node_modules/next/dist/docs/` for metadata, sitemap, OG images, caching and headers in Next 16.
5. Current CLI/API docs (context7 or web; do not guess flags) for the **Supabase CLI** (`projects
   create`, `projects api-keys`, `link`, `config push`, bucket seeding), the **Vercel CLI** (`project
   add`, `link`, `env add`, `git connect`, `domains add`), the **Resend API** (domains, webhooks),
   and Google OAuth client setup for Supabase Auth.

## Product in one paragraph

FTC Pitfund connects FIRST® Tech Challenge teams with companies that want to sponsor them. Adult
coaches sign in (Google or email code), create their team, upload a ≤5-page sponsorship deck PDF,
and pitch **approved** companies by answering each company's own questions plus an optional ask.
**An admin reviews every pitch** before the company sees it. Companies (open signup, hidden until an
admin approves them) respond Interested (contacts exchanged) or Not a fit. One pitch per team per company per
season. Teams and companies are shared accounts with equal members. Team pages are public at
`/t/{number}`. The platform never touches money. $0 budget except the domain: Vercel Hobby,
Supabase free, Resend free (100/day, quota-aware outbox). All infrastructure is owned by the team
Google account **`ftcexodius@gmail.com`**; the repo is `ExodiusFTC/FTC-Pitfund-Source-Code`. The
name is "FTC Pitfund", and the footer states "Not affiliated with or endorsed by FIRST®."

## Scope

### A. Landing page (`/`)

- Positioning from plan §1 ("Sponsorship pitches companies actually read."). Write the final copy
  yourself: specific, confident, no jargon ("dispatch", "submission", "portal", "pipeline", "RLS" never
  appear), no fabricated stats, no fake testimonials, no morphing words, no intro loader, no scroll-reveal
  that hides content.
- Structure: top bar (wordmark, "For companies" anchor, Sign in, primary CTA) · hero (headline, one
  sentence, two CTAs: "I coach a team" → `/login?intent=team`, "I represent a company" →
  `/login?intent=company`; the intent preselects the `/welcome` branch) · **real product screenshots**
  · How it works (Teams | Companies, 3 steps each) · What companies get · FAQ (Is it free? Who reviews pitches?
  What gets shared and when? Can students use it? What about photos of students? Is this run by
  FIRST?) · footer (links, support email `ftcexodius@gmail.com`, FIRST disclaimer, credits: "Built by
  Anish Yarrakonda · Idea by Rishi Jhaveri (outreach lead) and Shreyas Vempati (team captain) · FTC
  Team 31579 Exodius", phrased exactly with that attribution structure).
- Screenshots: a Playwright script (`npm run screenshots:marketing`) seeds `demo`, captures the
  composer, a company inbox pitch and the public team page at 1280 px @2x, and optimizes them to WebP in
  `public/marketing/`. Never hand-draw fake UI.
- Static rendering (no per-request work). A signed-in visitor must reach their app in one click
  (e.g. the top bar shows "Open FTC Pitfund" when a session cookie exists, decided client-side or in
  `proxy.ts` without making the page dynamic). Decide and document.

### B. Legal, SEO, polish

- Rewrite `/legal/terms` and `/legal/privacy` for v2: adults only, no student accounts; the data
  collected (name, email, avatar, optional phone and job title, team info, PDFs, logos); what's
  public (team pages, decks) versus shared on match (contacts) versus admin-only; photo permission
  responsibility; retention and account deletion; email use; no sale of data; contact. Add the banner
  "Plain-language draft. Have a qualified person review before launch." as an HTML comment, and a
  `docs/LAUNCH.md` item.
- Metadata for every public page; OG images (static for landing, deck thumbnail for teams);
  `sitemap.ts` (landing, legal, all non-suspended team pages); `robots.ts` (disallow `/admin`, `/dev`,
  app routes, `/invite`); favicon and app icons (a simple generated mark in the accent color); `not-found` and
  `error` pages that match the design.
- Security headers + CSP in `next.config` (allow Supabase, Google, Sentry, BotID, Vercel). Verify
  nothing breaks (OAuth redirect, PDF viewer worker, storage images, Sentry).

### C. Whole-product QA sweep (the most important part of this prompt)

1. Run `npm run qa` on **`demo`, `empty` and `edge`**. Zero failures.
2. **Open every screenshot in `qa/screens/`** (every route × persona × 375/768/1280) and
   judge it against plan §7 like a demanding design lead. Look for: weak hierarchy, crowded or
   empty regions, inconsistent spacing, misaligned baselines, too many borders/cards/badges, awkward
   wrapping, orphaned buttons, unclear primary action, low-information empty states, placeholder copy,
   jargon, inconsistent capitalization, anything that looks cheap or unfinished. Fix, re-run and
   re-inspect until nothing is left to fix. Record before/after pairs for the notable fixes in `docs/QA-REPORT.md`.
3. Walk **every state machine in plan §3.2** in a real browser (Playwright or a browser MCP), including
   every error branch, with fault injection: Slow 3G, offline mid-action, storage PUT aborted, FIRST
   API timeout, Resend 429/500, an admin decision conflict from two contexts, an expired OTP, a revoked invite,
   a withdrawn pitch opened by a company, exhausted email quota. Each branch must produce the specified human
   message and a way forward.
4. **Dead-click audit:** a script that clicks every button and link on every page (per persona, in
   a throwaway DB) and flags any click that produces no visible change, navigation, pending state or
   dialog within 150 ms. Fix every finding.
5. **Keyboard-only** pass of the four core journeys (coach pitch, admin review, company response,
   sign-in): logical focus order, visible focus, no traps, shortcuts documented. Screen-reader
   names for all controls (axe + a manual accessible-name review of icon buttons).
6. **Mobile (375 px)** usability of the composer, admin review, company inbox and PDF viewer. The
   interactions must be actually usable, not just "not overflowing".
7. Check that every email template renders well in Mailpit (desktop and a narrow viewport) and has a plain-text part.
8. Write `docs/QA-REPORT.md`: what was checked, how, findings fixed, and any accepted residual issues with reasons.

### D. Performance pass (plan §6 budgets, measured, not assumed)

- Per-route first-load JS from the build output; fix regressions (lazy-load pdf.js, remove heavy
  client imports, keep pages as server components by default).
- Lighthouse (mobile, Slow 4G) on `/`, `/t/[number]`, `/login` via a scripted run
  (`npm run perf`): performance ≥90, accessibility ≥95, CLS ≤0.05, LCP ≤2.0 s.
- Authed routes: add dev-only query counting and server timing; prove ≤5 queries per page and
  no sequential independent awaits on `/pitches`, `/sponsors`, `/inbox`, `/admin`,
  `/admin/pitches/[id]`. Server render ≤400 ms p95 locally.
- Interaction latency: ActionButton pending ≤100 ms (`qa` check). Server actions ≤500 ms p95 excluding `after()` work.
- Add budgets to `npm run qa`/`npm run perf` so regressions fail CI.

### E. Security and correctness pass

- A static test that enumerates every exported server action and route handler and asserts each
  calls an authz guard (or is on an explicit public allowlist: login, auth callback, send-email hook
  with signature, resend webhook with signature, cron with secret, health, report with BotID).
- Grep the production build output for the service-role key, `DATABASE_URL` and other secrets. It must be clean.
- Confirm RLS is enabled on every table and the anon key reads nothing via REST (test with `curl`
  against local PostgREST).
- `/dev/*` returns 404 in a production build (test exists; run it). Upload validation can't be bypassed
  by calling `finalize` with a foreign or unverified path. Invite tokens are single-use and email-bound.
- `npm audit --omit=dev`: fix high/critical. `knip`: zero unused files, exports and dependencies.
- Confirm no non-goal from plan §1 exists anywhere in the codebase (grep for leftovers: clerk,
  capacity, ledger, appeal, impact, analytics, roles, SSO, MFA, password).

### F. Automated provisioning (`scripts/provision/`)

Goal: after Anish creates the accounts and pastes tokens once, **one command** builds production.
Every script is idempotent, supports `--dry-run`, prints exactly what it did and did not do, reads
secrets from a gitignored `.env.provision`, and **never deletes or modifies v1 resources**.

- `npm run provision:check`: verifies the CLIs (`supabase`, `vercel`, `gh`) and tokens present,
  which accounts they belong to (warn loudly if any token is not owned by `ftcexodius@gmail.com`'s
  accounts), and domain availability.
- `npm run provision:supabase`: create or find the **production** project and a **staging** project
  (for Vercel previews) in the team org, region `us-east-1`; fetch keys; run `db:migrate --remote`
  against each; create the storage buckets; push auth config (site URL, redirect URLs incl. preview
  wildcard for staging, OTP settings, Google provider if credentials exist, Send Email hook URL +
  secret); seed staging with `demo` (never seed production); `admin:grant --remote` for the listed admin emails.
- `npm run provision:vercel`: link/create the project **under the team account** (never the old
  personal v1 project), set all env vars for `production` (prod Supabase) and `preview` (staging
  Supabase), generate `CRON_SECRET` and the hook secret, connect the Git repo so pushes to `main`
  deploy, add the domain and print the DNS records needed.
- `npm run provision:resend`: add the sending domain via API, print its DNS records, create the
  webhook to `/api/webhooks/resend`, and store the signing secret into Vercel env.
- `npm run provision:sentry` (optional): create the project via API and set the DSN.
- `npm run provision`: runs the above in order, stops clearly at any step waiting on a human (e.g.
  "Add these DNS records, then re-run"), and resumes idempotently.
- `npm run provision:verify`: a production smoke test (`/api/health`, landing, `/login` renders both
  sign-in methods, a test email to `ftcexodius@gmail.com` through the outbox, a cron trigger with the
  secret, `/dev` 404, security headers present).

### G. Documentation

- **`docs/LAUNCH.md`** (the single launch doc; replace everything older) contains **only human
  steps**, in order, each with exact values and "done when" checks:
  1. Sign into `ftcexodius@gmail.com`, then create accounts: GitHub (join the `ExodiusFTC` org as
     owner), Vercel (Hobby), Supabase (create org "FTC Pitfund"), Resend, Google Cloud (project "FTC
     Pitfund"), Sentry (optional). Add teammates where free plans allow (GitHub org, Supabase org, Resend
     team). Store the shared logins in a password manager.
  2. Create tokens (Supabase access token, Vercel token, Resend API key, Sentry token) → paste into
     `.env.provision` (template provided).
  3. Buy the domain (recommend a registrar with at-cost pricing; list 2 options with prices checked
     at writing time).
  4. `npm run provision` (it tells you when to do step 5 and 6).
  5. Google OAuth: consent screen (External; app name "FTC Pitfund"; support email; authorized
     domain), Web client with the redirect URI the script printed → paste the client id/secret into
     `.env.provision` → `npm run provision:supabase -- --auth-only`. Note Google's branding verification if a logo is shown.
  6. Add the DNS records the scripts printed (Vercel + Resend SPF/DKIM + DMARC).
  7. `npm run provision:verify`.
  8. Have the legal pages reviewed by a qualified person.
  9. **Decommission v1 only after Anish confirms v2 is live**: the old personal Vercel project,
     Clerk application, old Supabase project and personal Resend. List exact steps, but do not perform them.
- **`docs/RUNBOOK.md`** for a non-programmer operator: daily review routine; what each System
  warning means and what to do; when to pay for what (thresholds from plan §9); backups
  (`npm run db:backup`); adding or removing an admin; rotating secrets; handing ownership to a new captain;
  what to do if email stops, the site pauses, or a report arrives.
- Final rewrite of `CLAUDE.md`, `.claude/rules/*`, `README.md` (what it is, a 3-command local start,
  links to docs) and `prompts/_NEXT-SESSION.md` ("v2 complete; next: run docs/LAUNCH.md").
  `prompts/rebuild/` stays as history. Update `.gitignore` so `docs/` is tracked normally (v1 had
  a trap where `/docs/*` was ignored; verify with `git ls-files docs`).

### H. Acceptance and merge

1. Go through **every checkbox in plan §12** and prove each with a command, test, screenshot or
   file reference in `docs/QA-REPORT.md`. Anything not provable is not done. Fix it.
2. Final full run from a clean clone in a temp directory: `npm install && npm run setup && npm run
   check && npm run build && npm run e2e && npm run qa && npm run perf`, all green. CI green on the branch.
3. Merge `rebuild` into `main` (a merge commit named `feat: FTC Pitfund v2 rebuild`), push `main`, and keep
   the `legacy-v1` tag. **Do not deploy to, modify, or delete the v1 production Vercel project, Clerk,
   or v1 Supabase.** v2 goes live only through `docs/LAUNCH.md` on the team accounts.
4. Commit messages are conventional and end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
   After committing new docs, prove they landed with `git ls-files`.

## Done means

- Every plan §12 checkbox is proven in `docs/QA-REPORT.md`.
- The landing page communicates value in one screen, uses real screenshots, and is fast.
- Every screenshot has been looked at, and nothing looks unfinished at any width or in any seed scenario.
- Production can be built from zero by following `docs/LAUNCH.md`, whose steps are all human-only and
  minimal; everything else is `npm run provision`.
- `main` contains v2; CI green.
- The final message to Anish is short: what's done, the proof, and the exact first step of `docs/LAUNCH.md` for him to do.
