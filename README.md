# FTC Pitfund

Sponsorship pitches companies actually read. FIRST® Tech Challenge teams upload their deck once,
answer each sponsor's own questions, and a real person reviews every pitch before it reaches the
company. Not affiliated with or endorsed by FIRST®.

> The v2 rebuild is in progress on the `rebuild` branch. The plan is
> [`prompts/rebuild/00-REBUILD-PLAN.md`](prompts/rebuild/00-REBUILD-PLAN.md).

## Run it locally

The only prerequisite is [Docker Desktop](https://www.docker.com/products/docker-desktop), running.

```bash
npm install
npm run setup   # local Supabase, .env.local, migrations, demo data
npm run dev     # http://127.0.0.1:3000
```

- Sign in as any persona with one click: `http://127.0.0.1:3000/dev`
- Every component in every state: `http://127.0.0.1:3000/dev/ui`
- Emails the app sends (sign-in codes included): `http://127.0.0.1:54324`

## Check it

```bash
npm run check   # typecheck, lint, unit and integration tests
npm run e2e     # Playwright journeys
npm run qa      # visual and UX sweep at 375/768/1280 → qa/report.md, qa/screens/
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 + Radix · Supabase (Auth, Postgres, Storage) ·
Drizzle · Resend + React Email · Sentry · Vercel. See [`CLAUDE.md`](CLAUDE.md) for the architecture
and conventions.

Questions: ftcexodius@gmail.com
