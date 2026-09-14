# FTC Pitfund (v2)

**Rebuild in progress on branch `rebuild`.** The source of truth is
**`prompts/rebuild/00-REBUILD-PLAN.md`**; work is executed by `prompts/rebuild/01` → `02` → `03` → `04`.
Where anything disagrees with the plan, the plan wins. Read `prompts/_NEXT-SESSION.md` first.
The v1 app (Clerk, RLS policies, capacity caps, ledger) is gone; it is preserved at git tag `legacy-v1`.

## Product

FTC Pitfund connects FIRST® Tech Challenge teams with companies that sponsor robotics teams.
Adult coaches sign in (Google or a 6-digit email code), create or join one shared team account,
upload a sponsorship deck PDF (≤5 pages, ≤10 MB) and a one-line summary, and pitch **approved**
companies by answering each company's own questions (≤10, or 3 defaults). **An admin reviews every
pitch** before the company sees it. A company answers **Interested** (contacts are exchanged, the
pitch is *matched*) or **Not a fit**. One pitch per team per company per season (Sept 1).
No money handling, no caps, no messaging. $0 budget except the domain.

## Core rules (plan §1; never violate)

- Adults only. No student accounts. Teams and companies are one shared account with equal members; **no roles**.
- Pitches go only to approved companies. Pending companies are invisible to coaches.
- Every pitch is admin-reviewed before a company sees it.
- One pitch per team × company × season; withdrawing before a response frees the slot.
- Sign-in is Google or email code. **No passwords, no MFA.**
- Email is capped at 100/day: it is always queued through the outbox, quota-aware, and never fails silently.
  The in-app notification is always written; email is a copy.
- Contact details are returned only for matched pitches, only to the two orgs involved.
- Non-goals (plan §1) must not be built: messaging, caps/ledger, roles, SSO, e-sign, payments, student accounts, dark mode.

## Stack

Next.js 16 App Router (`cacheComponents: true`) · React 19 · TypeScript strict · Tailwind v4 + Radix
(`radix-ui`) · Supabase Auth (`@supabase/ssr`) · Postgres via **Drizzle** (`postgres` driver,
`prepare: false`) · Supabase Storage · Resend + React Email (`react-email`) + `email_outbox` ·
Sentry · Vercel BotID · Vitest · Playwright + axe · Vercel Hobby (`iad1`), one cron.

## Module layout

```text
app/(public)/      landing, login, legal            app/(app)/          shell: welcome, account
app/(app)/(workspace)/  pitches sponsors team inbox company (org required)
app/admin/         review, pitches/[id], companies/[id], teams/[id], directory, system    app/dev/  /dev, /dev/ui
app/actions/       server actions ('use server')    app/api/            auth/send-email, webhooks/resend, cron/daily, health, dev/sign-in
lib/server/        server-only: db, schema, env, authz, viewer, result, audit, notify, storage,
                   ftc-records, jobs, page-guards, transaction, supabase(-admin), data/*, email/*
lib/shared/        types, labels, format, season, questions, personas, result, schemas/* (client-safe)
lib/client/        use-action, supabase (browser)   components/ui/      the design system
components/app/    shell, top bar, bell, menus      drizzle/            generated migrations
scripts/           setup, db-*, seed/, admin-grant, drain-outbox, serve-prod
tests/unit         Vitest (rolled-back transactions)  tests/e2e  Playwright  tests/qa  the UX gate
proxy.ts           session refresh only (plus x-pathname); no role logic
```

## The action shape (every mutation)

```ts
export const doThing = defineAction(schema, async (input) => {   // 1. zod validation → Result
  const viewer = await requireTeamMember()                         // 2. authz guard (lib/server/authz.ts)
  const row = await inTransaction(async () => {                    // 3. data function(s) (lib/server/data/*)
    const r = await updateThing(viewer, input)
    await audit({ actorId: viewer.id, action: 'thing.updated', entityType: 'team', entityId: r.id })  // 4. audit
    await notifyTeam(r.teamId, { type, title, href }, { exceptUserId: viewer.id })                     // 5. in-app notify
    await enqueueEmail({ to, template, data, priority: PRIORITY.transactional, dedupeKey })          //    email copy
    return r
  })
  after(() => drainOutbox())                                        // 6. send email after the response
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
| `npm run e2e` | Playwright journeys (dev server :3000 + production build :3100) |
| `npm run qa` | the UX gate over `tests/qa/routes.ts`, `demo` then `edge`; writes `qa/report.md` and `qa/screens/` |
| `npm run db:generate` / `db:migrate` / `db:reset` | Drizzle migrations (migrate refuses non-local hosts without `--remote` + `CONFIRM_REMOTE=1`) |
| `npm run seed -- --scenario demo\|empty\|edge` | idempotent fixtures |
| `npm run admin:grant -- email` · `email:drain` · `cron:run` · `db:backup` | ops (`cron:run` calls `/api/cron/daily` on :3000 with `CRON_SECRET`) |

## Rules for agents

- **Never ask Anish to click-test, paste SQL, or create test accounts.** Use the scripts, `/dev`, Playwright and Mailpit.
- **Never hand-write SQL against a real database.** Change `lib/server/schema.ts`, `npm run db:generate`, `npm run db:migrate`.
- Before calling UI work done: `npm run check`, `npm run e2e`, `npm run qa`, then **open the screenshots** in `qa/screens/` and fix anything that looks unfinished (plan §7).
- New routes go into `tests/qa/routes.ts`. New components get every state on `/dev/ui`.
- Details: `.claude/rules/architecture.md`, `data-and-auth.md`, `ux-contract.md`, `testing-and-qa.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
