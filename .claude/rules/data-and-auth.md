# Data and auth (v2)

## Database
- Schema: `lib/server/schema.ts` (plan §4). Migrations are generated into `drizzle/` by `npm run db:generate`
  and applied by `npm run db:migrate`. Never edit a generated migration after it has been applied; add a new one.
  Custom SQL (rare): `npm run db:generate -- --custom --name x`.
- **RLS is enabled with zero policies on every table** and `anon`/`authenticated` hold no grants
  (`drizzle/0001_rls_lockdown.sql`, asserted by `tests/unit/season-and-schema.test.ts`). Supabase REST exposes
  nothing. The app connects as the owner through `lib/server/db.ts`. New tables: add `.enableRLS()`.
- Uniqueness lives in the database and is mapped to friendly `CONFLICT` messages with `mapDbError`
  (e.g. `pitches_one_per_season_key`, `team_members_user_key`, `sponsor_members_user_key`).
- State transitions are idempotent: `UPDATE … WHERE status = expected RETURNING`; zero rows → `CONFLICT`.
- `users.id` = `auth.users.id` (cascade). Deleting the auth user removes the person, memberships and
  notifications; history keeps `actor_id = null`.

## Auth
- Supabase Auth: Google OAuth (PKCE, browser client → `/auth/callback`) and 6-digit email OTP
  (`app/actions/auth.ts`: `requestLoginCode` with BotID, `verifyLoginCode`).
- Supabase says `otp_expired` for both wrong and expired codes; the login page decides by time since sending.
- Local stack: `supabase/config.toml` (OTP 6 digits / 10 min, `max_frequency` 5 s, Send Email hook →
  `host.docker.internal:3000`). `supabase/.env` holds the generated hook secret and Google toggle.
- Production auth settings (site URL, redirect URLs, OTP, Google, Send Email hook) are applied by `npm run provision:supabase`, never by hand.

## Authorization
- Always `require*` from `lib/server/authz.ts`, then pass the viewer into data functions.
- Suspended users, teams and companies are blocked inside the guards.
- A pending company can edit its profile but is invisible to coaches; `requireApprovedSponsor` for anything outward.
- Contact snapshots (`pitches.team_contact`, `sponsor_contact`) are read only for `matched` pitches, only by the two orgs.
- Tests: `tests/unit/authz.test.ts` is the guard × persona matrix. Extend it when adding a guard or persona.

## Local accounts
Personas `admin, coach-new, coach, coach-unverified, coach-joiner, sponsor-new, sponsor-pending, sponsor,
sponsor2` at `{persona}@pitfund.test`. Sign in with one click at `/dev` or `GET /api/dev/sign-in?persona=`.
`/dev/*` is a 404 unless `NODE_ENV !== 'production'` and Supabase is `127.0.0.1`/`localhost`.
