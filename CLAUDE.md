# FTC Pitfund (v2)

**v2 is live** at https://pitfund.org (launched 2026-09-20) and finished; work from here is post-launch changes.
**Every push to `main` auto-deploys to production** (Vercel team project `ftc-pitfund`), so branch, run `npm run check`,
then merge. Day-to-day operation is **`docs/RUNBOOK.md`**; `docs/LAUNCH.md` is the re-provisioning reference
(`npm run provision`). `prompts/rebuild/00-REBUILD-PLAN.md` is the original design document: where it disagrees with this
file or `.claude/rules/*` (it still describes Google sign-in), this file wins. The v1 app (Clerk, RLS policies,
capacity caps, ledger) is gone; it is preserved at git tag `legacy-v1`.

## Product

FTC Pitfund connects FIRST® Tech Challenge teams with companies that sponsor robotics teams.
Adult coaches sign in (a 6-digit email code), find their team in FIRST's list (by number or name; a team FIRST doesn't list can't be created), create or join one shared team account,
upload a sponsorship deck PDF (≤5 pages, ≤10 MB) and a one-line summary, and pitch **approved**
companies by answering each company's own questions (≤10, or 3 defaults). **Teams and companies are
both admin-reviewed before they reach the app**, and **an admin reviews every pitch** before the
company sees it. A company answers **Interested** (contacts are exchanged, the
pitch is *matched*) or **Not a fit**. One pitch per team per company per season (Sept 1).
No money handling, no caps, no messaging. $0 budget except the domain.

## Core rules (plan §1; never violate)

- Adults only. No student accounts. Teams and companies are one shared account. **One member owns it**
  (`owner`); everyone else is an `editor`. Only the owner invites, removes and hands ownership on; the
  owner can't leave without transferring. Everything else both roles can do.
- **Both orgs are admin-approved before they reach the app** (`draft → pending → approved | rejected`).
  A team proves itself with a FIRST Dashboard screenshot in the private `verification` bucket. Nothing
  about an unapproved org is reachable, including its public page.
- Pitches go only to approved companies. Pending companies are invisible to coaches.
- Every pitch is admin-reviewed before a company sees it.
- One pitch per team × company × season; withdrawing before a response frees the slot.
- Sign-in is an email code. **No passwords, no MFA, no third-party (Google) sign-in.**
- Email is capped at 100/day: it is always queued through the outbox, quota-aware, and never fails silently.
  The in-app notification is always written; email is a copy.
- Contact details are returned only for matched pitches, only to the two orgs involved.
- Non-goals (plan §1) must not be built: messaging, caps/ledger, role *tiers* beyond owner/editor, SSO,
  e-sign, payments, student accounts, dark mode.
  `npm run security:scan` greps for leftovers.

## Stack

Next.js 16 App Router (`cacheComponents: true`) · React 19 · TypeScript strict · Tailwind v4 + Radix
(`radix-ui`, loaded on demand) · Supabase Auth (`@supabase/ssr`) · Postgres via **Drizzle** (`postgres` driver,
`prepare: false`) · Supabase Storage · Resend + React Email (`react-email`) + `email_outbox` ·
Vercel BotID · Vitest · Playwright + axe + Lighthouse · Vercel Hobby (`iad1`), one cron.

## Module layout

```text
app/(public)/      landing, login, legal, t/[number], invite   app/(app)/   shell: welcome, account
app/(app)/(workspace)/  pitches sponsors team inbox company (org required)
app/admin/         review, pitches/[id], companies/[id], teams/[id], directory, system    app/dev/  /dev, /dev/ui
app/actions/       server actions ('use server')    app/api/     auth/send-email, webhooks/resend, cron/daily, health, revalidate, dev/sign-in
app/sitemap.ts robots.ts apple-icon.tsx, **/opengraph-image.tsx (lib/server/og.tsx)
lib/server/        server-only: db, schema, env, authz, viewer, result, audit, notify, storage, uploads,
                   ftc-records, jobs, digest, page-guards, transaction, supabase(-admin), og, data/*, email/*
lib/shared/        types, labels, format, season, questions, personas, result, cn, nav, schemas/* (client-safe)
lib/client/        use-action, toast (lazy Sonner), lazy (useLazyComponent), pdf, upload, image
components/ui/     the design system          components/app/  shell, top bar, bell, menus, landing island
components/members/  members + invites section (server) with client controls
drizzle/           generated migrations       scripts/  setup, db-*, seed/, admin-grant, provision/, prod, perf,
                                                         security-scan, email-preview, marketing-screenshots, serve-prod
tests/unit  Vitest   tests/e2e  Playwright   tests/qa  UX gate + dead-click audit   docs/  LAUNCH, RUNBOOK
proxy.ts           session refresh only (plus x-pathname); no authorization
```

## The action shape (every mutation)

```ts
export const doThing = defineAction(schema, async (input) => {   // 1. zod validation → Result
  const viewer = await requireTeamMember()                         // 2. authz guard first (tests/unit/authz-coverage.test.ts)
  const row = await inTransaction(async () => {                    // 3. data function(s) (lib/server/data/*)
    const r = await updateThing(viewer, input)
    await audit({ actorId: viewer.id, action: 'thing.updated', entityType: 'team', entityId: r.id })  // 4. audit
    await notifyTeam(r.teamId, { type, title, href }, { exceptUserId: viewer.id })                     // 5. in-app notify
    await enqueueEmail({ to, template, data, priority: PRIORITY.transactional, dedupeKey })          //    email copy
    return r
  })
  await scheduleDrain()                                             // 6. send email after the response
  revalidateTag(`team:${row.teamId}`, 'max')                        // 7. revalidate
  return { ...row }                                                 // 8. Result (never throw to the client)
})
```

Client side: `useAction(action)` or `<ActionButton action pendingLabel>`; never a bare onClick.

## Commands

| Command | What it does |
| --- | --- |
| `npm run setup` | Docker check → `supabase start` → `.env.local` → migrate → seed `demo` (only prerequisite: Docker) |
| `npm run dev` | `http://127.0.0.1:3000` · personas at `/dev` · gallery at `/dev/ui` · email at `http://127.0.0.1:54324` |
| `npm run check` | typecheck + lint (0 warnings) + Vitest |
| `npm run build` | production build |
| `npm run e2e` | Playwright journeys, including the §12 acceptance timings (dev server :3000 + production build :3100) |
| `npm run qa` | the UX gate over `tests/qa/routes.ts` on `demo`, `edge`, `empty`; writes `qa/report.md` and `qa/screens/` |
| `npm run qa:clicks` | dead-click audit: every button must do something within 150 ms, every link must go somewhere |
| `npm run perf` | first-load JS ≤170 KB per route, Lighthouse mobile on `/`, `/t/[n]`, `/login`, queries ≤5 and render p95, action p95 |
| `npm run security:scan` | secrets in build output, anon REST, `/dev` in production, non-goal leftovers |
| `npm run email:preview` | every email template (and long variants) into Mailpit, checked and screenshotted to `qa/emails/` |
| `npm run knip` | zero unused files, exports and dependencies |
| `npm run db:generate` / `db:migrate` / `db:reset` | Drizzle migrations (migrate refuses non-local hosts without `--remote` + `CONFIRM_REMOTE=1`) |
| `npm run seed -- --scenario demo\|empty\|edge` | idempotent fixtures |
| `npm run admin:grant -- email` · `email:drain` · `cron:run` · `ftc:sync` · `db:backup` | local ops (`cron:run` calls `/api/cron/daily` on :3000; `ftc:sync` copies FIRST's team list into `ftc_team_cache`) |
| `npm run provision` · `provision:check\|supabase\|vercel\|resend\|verify` | build production from `.env.local` (docs/LAUNCH.md) |
| `npm run prod -- backup\|admin email [--revoke]` | ops against the hosted database using `.env.local` |
| `npm run screenshots:marketing` | recapture the landing page screenshots from the seeded production build |

## Rules for agents

- **Never ask Anish to click-test, paste SQL, or create test accounts.** Use the scripts, `/dev`, Playwright and Mailpit.
- **Never hand-write SQL against a real database.** Change `lib/server/schema.ts`, `npm run db:generate`, `npm run db:migrate`.
- **`.env.local` holds local-stack values and production values** (`SUPABASE_PRODUCTION_*`, `PRODUCTION_CRON_SECRET`,
  `RESEND_FULL_ACCESS_KEY`, `VERCEL_TOKEN`). Before any database-touching test, seed or reset, confirm the database host is
  `127.0.0.1`/`localhost`. Never print secret values (names are fine). Production ops go through `npm run prod -- …`.
- **Never deploy to, modify or delete the v1 production resources** (personal Vercel project `ftc-sponsorship-portal`,
  Clerk, Supabase `qqizqbtwigyedgskoezm`). Provisioning refuses them by id.
- Before calling UI work done: `npm run check`, `npm run e2e`, `npm run qa`, `npm run perf`, then **open the screenshots**
  in `qa/screens/` and fix anything that looks unfinished (plan §7).
- New routes go into `tests/qa/routes.ts`. New components get every state on `/dev/ui`. New actions/handlers call a guard
  first or join the public allowlist in `tests/unit/authz-coverage.test.ts` with the check they do instead.
- Keep first-load JS in budget: Radix overlays, pdf.js, Sonner and upload helpers load on first use (see `architecture.md`).
- Details: `.claude/rules/architecture.md`, `data-and-auth.md`, `ux-contract.md`, `testing-and-qa.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
