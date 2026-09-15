# FTC Pitfund

Sponsorship pitches companies actually read. FIRST® Tech Challenge teams upload their deck once,
answer each sponsor's own questions, and a real person reviews every pitch before it reaches the
company. Companies that sponsor robotics teams get screened pitches in one inbox and connect in one
click. Free for teams and companies. Not affiliated with or endorsed by FIRST®.

Built by Anish Yarrakonda · Idea by Rishi Jhaveri (outreach lead) and Shreyas Vempati (team captain) ·
FTC Team 31579 Exodius.

## Run it locally

The only prerequisite is [Docker Desktop](https://www.docker.com/products/docker-desktop), running, and Node 22+.

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
npm run check          # typecheck, lint, unit and integration tests
npm run e2e            # Playwright journeys, including the acceptance timings
npm run qa             # visual and UX sweep at 375/768/1280 on three data sets → qa/report.md, qa/screens/
npm run perf           # bundle, Lighthouse, query and latency budgets
npm run security:scan  # secrets, database exposure, dev tools in production
```

## Launch and operate

- [`docs/LAUNCH.md`](docs/LAUNCH.md): the human steps to go live; everything else is `npm run provision`.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md): daily review, System warnings, backups, admins, secrets, incidents.
- [`docs/QA-REPORT.md`](docs/QA-REPORT.md): what was checked and the proof for every acceptance criterion.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 + Radix · Supabase (Auth, Postgres, Storage) ·
Drizzle · Resend + React Email · Sentry · Vercel. See [`CLAUDE.md`](CLAUDE.md) for the architecture
and conventions.

Questions: ftcexodius@gmail.com
