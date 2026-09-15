# Next session

**Updated 2026-09-15. v2 is complete: prompts 1–4 are done and `rebuild` is merged into `main`.**
**Next: follow [`docs/LAUNCH.md`](../docs/LAUNCH.md)** (the human steps: accounts, tokens, domain, Google OAuth,
DNS, then `npm run provision` and `npm run provision:verify`). Nothing is deployed yet, and v1 production is untouched.
Team email: **ftcexodius@gmail.com**.

## Where things are

- **Launch:** `docs/LAUNCH.md` (human steps only) · `scripts/provision/*` (`npm run provision`, idempotent,
  `--dry-run`, refuses v1 resources by id; secrets in the gitignored `.env.provision`, template `.env.provision.example`).
- **Operate:** `docs/RUNBOOK.md` · `npm run prod -- backup|admin …` runs ops against the hosted database.
- **Proof:** `docs/QA-REPORT.md` maps every plan §12 criterion to the command, test or screenshot that proves it.
- **Design source of truth:** `prompts/rebuild/00-REBUILD-PLAN.md` (history: `prompts/rebuild/01–04`).
- **Conventions:** `CLAUDE.md`, `.claude/rules/{architecture,data-and-auth,ux-contract,testing-and-qa}.md`.

## What prompt 4 added

- Final landing page (static; real screenshots from `npm run screenshots:marketing`; session-aware top bar island;
  "I coach a team" / "I represent a company" carry `?intent` through email-code and Google sign-in to preselect `/welcome`).
- v2 Terms and Privacy (plain-language drafts, marked for legal review), sitemap, robots, share cards (`lib/server/og.tsx`),
  apple icon. New companies land on `/company` after sign-up (profile + questions is what approval waits on).
- Performance: every route ≤170 KB first-load JS (largest `/company` ~167 KB), Lighthouse mobile 99–100 perf /
  100 a11y, LCP ≤2 s, ≤5 queries per authed list/review page. See the "First-load JS" section of `architecture.md`.
- Gates: `npm run perf`, `qa:clicks`, `security:scan`, `email:preview`, `knip` (zero), `tests/unit/authz-coverage.test.ts`,
  `tests/unit/cn.test.ts`, `tests/e2e/{acceptance,intent,fault-injection}.spec.ts`, QA `empty` scenario. CI runs them all.

## Things the next agent must know

- **Cache Components is on.** Runtime data (`cookies`, DB) must sit under Suspense (`loading.tsx` works).
  The `(app)` and `admin` layouts set `export const instant = false` because they redirect signed-out users.
  Route handlers touching the DB call `connection()`. Hidden routes stay mounted (React Activity): going
  back to a form keeps its state — tests must not assume a reset.
- In **production**, primary nav links are fully prefetched (navigation is instant; no skeleton). In
  `next dev` there is no prefetch. Test loading skeletons against the production server (`:3100`).
- **`server-only` throws outside Next.** Scripts run with `--import ./scripts/lib/server-only-stub.mjs`
  (package.json does this); Vitest aliases it; drizzle-kit runs with the stub via `NODE_OPTIONS`.
- **Action shape:** `defineAction` → guard → `inTransaction(data + audit + notify + enqueueEmail)` →
  `after(drainOutbox)` → revalidate → Result. `lib/server/transaction.ts` exists so actions never import the DB.
- **Supabase says `otp_expired` for wrong and expired codes alike**; the login page decides by time since
  sending. Local `max_frequency` is 5 s (the page's resend countdown is 30 s). A browser fake clock does not
  move Supabase's clock; E2E waits real seconds where that matters.
- **Local email:** SMTP to Mailpit on `127.0.0.1:54325`, UI on `:54324`. The Send Email hook calls
  `host.docker.internal:3000`, so login emails only work with the dev server on port 3000.
- Auth sign-in codes are sent synchronously and **fail instead of deferring** when the quota is gone (a late
  code is useless); their payload is scrubbed from the outbox after sending.
- `/api/dev/sign-in` and `/dev/*` are prerendered as 404 in production builds (E2E asserts it).
- QA signs personas in without the UI by minting a magic-link token with the local secret key
  (`tests/support/session.ts`); E2E uses `/api/dev/sign-in`. Cookies are per host, not per port, so both
  servers share sessions.
- Supabase CLI is a devDependency (2.117). Its config section is `[local_smtp]` (was `[inbucket]`). `setup`
  restarts the stack if the running auth container has a different hook secret (another checkout started it).
- The overflow check in QA measures text runs, not `scrollWidth`; a `pre-wrap` hanging space is ignored.
  If QA flags overflow, it is real: add `min-w-0` to the grid/flex child (Tabs got this; see `components/ui/tabs.tsx`).
- Seeded logos and thumbnails are PNG (the plan says WebP for uploads; prompt 2's upload path produces WebP).
- **Status codes and `notFound()`.** Under a Suspense boundary (a `loading.tsx` counts) the response has
  already streamed as 200, so workspace pages render the 404 UI with status 200. In a production build every
  dynamic route streams its static shell first, so even `/t/[number]` (no `loading.tsx`, `instant = false`)
  is a **soft 404 in production** (200 + 404 UI + `noindex`) and a real 404 only in `next dev`. A real
  production 404 would need a DB lookup in `proxy.ts` (Next's documented route), which the plan keeps
  session-only. E2E asserts both behaviors. The root layout sets no default `robots` tag, so the injected
  `noindex` never competes with `index, follow`.
- **Tag expiry has one-second resolution.** An entry cached in the same second as `revalidateTag(tag,
  { expire: 0 })` can survive it; tests wait 1 s after warming a page before expiring.
- **pdf.js 6:** `PDFDocumentProxy` has no `destroy()`; `openPdf()` in `lib/client/pdf.ts` returns a document
  whose `destroy` calls the loading task's.
- **Supabase Storage bucket named `public`:** `storage.from('public').download()` hits the public-object route
  and fails ("Bucket not found"); read public objects over HTTP (`publicUrl()`). Overwriting a signed upload
  path is a 409; cross-bucket `move` works; staging refuses `text/html`.
- Running `npm run build` while `npm run dev` is up rewrites `.next` and can reload the dev server mid-test;
  one E2E run failed that way (a blank page) and passed on rerun. Don't build during an E2E run.
- E2E that uses a file input waits for hydration (`waitUntil: 'networkidle'`) — an early `setInputFiles`
  is silently lost.


## Learned in prompt 4

- **First-load JS is mostly the framework** (~145 KB of React + Next). Radix, Sonner, pdf.js and tailwind-merge each
  cost 8–25 KB; they now load on first use or were replaced. Turbopack ships whole modules, so split big client modules.
- **Lighthouse's simulated LCP counts every request that started before the observed LCP.** On a fast local server the
  scripts finish before the paint, so they become dependencies. Keep the LCP element in the static shell, give its image
  `fetchPriority="high"`, and don't preload the web font.
- **A Suspense fallback that renders the same client form gets replaced when the stream arrives**, wiping typed input.
  Read search params in the browser (`useSyncExternalStore`) and keep one instance.
- **A server component can't render `Button` without `asChild`**: it attaches an onClick, and the page errors with
  "Event handlers cannot be passed to Client Component props". Use `buttonVariants()` on a plain element.
- **Dialogs opened without a trigger** return focus to whatever was focused when they opened (`openerRef` in `dialog.tsx`).
- **Lazily loaded toast code must be fetched before the network drops**: `<Toaster>` prefetches at idle.
- **next/image and local Supabase:** the optimizer refuses 127.0.0.1 unless `dangerouslyAllowLocalIP`; it is on only
  when Supabase itself is local.
- `npm run perf` measures bundles as gzip -9 of scripts requested before `load` (the wire adds ~1 KB of headers per file).
