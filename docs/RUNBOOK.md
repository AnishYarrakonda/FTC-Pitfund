# Running FTC Pitfund

For whoever operates FTC Pitfund day to day. You don't need to write code. A few tasks need a terminal in this repository with `npm install` done and the team's `.env.local` file (from the password manager) in the repository folder.

- **Admin console:** `https://<your domain>/admin`. Sign in as an admin (an email code).
- **Support inbox:** `NEXT_PUBLIC_SUPPORT_EMAIL` (ftcexodius@gmail.com at launch). Companies and coaches write here, and the daily summary arrives here. To change it everywhere (site, legal pages, emails, digest), change that Vercel env var and redeploy.
- **Dashboards** (all owned by ftcexodius@gmail.com): [Vercel](https://vercel.com/dashboard) (site, logs), [Supabase](https://supabase.com/dashboard) (database, storage), [Resend](https://resend.com/emails) (email). The System page links to each.

## Every day (about 10 minutes)

1. **Read the daily summary.** "FTC Pitfund daily: 34/100 emails, …" arrives every day around 13:00 UTC (9 am Eastern), even on a quiet one. It leads with how many emails went out through Resend in the last 24 hours (and warns from 80), then what happened in the app, then what is waiting: pitches to review, companies and teams to approve, reports.
2. **Review pitches.** `/admin` → Pitches, oldest first. Open one and read the answers, the ask and the deck. Then:
   - **Approve & send** if it's a real team with a finished pitch. The company gets it right away.
   - **Send back** with a note saying exactly what to fix ("Answer question 2 with numbers").
   - **Reject** only for spam, abuse or a team that doesn't exist. The team is told.
   - Keyboard: `J` next, `K` previous, `A` approve, `S` send back, `R` reject.
   - A pitch waiting more than a day is marked in orange. Try to keep the queue under that.
3. **Approve companies.** `/admin` → Companies. Check the website is a real business that could sponsor a robotics team. Approve, or reject with a reason. A company that isn't approved can't sign in to the app and coaches can't see it.
4. **Approve teams.** `/admin` → Teams. Nobody reaches the app until you approve them, so this is the step that keeps strangers from claiming a team's identity. On the team page, three things have to agree:
   - **The FIRST record.** "Found in FIRST records" means the number and name match FIRST's own list. "Not found" isn't automatically a rejection (very new teams lag), but it means the screenshot has to carry the weight.
   - **Proof they coach this team.** A screenshot of their FIRST Dashboard team page. Check the **team number** and the current season. It may come from any coach or mentor's account (students often sign up for their coach), so the name on it doesn't have to match the person who signed up.
   - **The coaches listed on the right.** The email should look like a person, not a throwaway.

   Then **Approve** (they get an email and the app opens up; the check mark shows on their public page) or **Reject** with a note saying what to send instead ("The screenshot doesn't show your name — send the Dashboard page that lists the coaches"). A rejected team can fix it and submit again. The screenshot link expires after 15 minutes; reload the page to get a fresh one. Screenshots are private, are never shown on the public site, and are **deleted the moment you approve the team** — so decide before you approve, and if you need another look later, ask the team to send a new one.
5. **Reports.** `/admin` → Reports. Open the team page. If the report is right (inappropriate photos, impersonation, spam), open the team and **Suspend**: its page disappears and its open pitches are withdrawn. Otherwise resolve the report. Reply to the reporter if they left an email.
6. **Glance at System** (`/admin/system`). No orange banners means nothing needs you.

## What the System page means

| You see | What it means | What to do |
| --- | --- | --- |
| **"The daily job hasn't run in over 36 hours"** | Vercel's cron didn't call the app: queued email, the digest, upload cleanup and the database keepalive stopped. | Vercel → project `ftc-pitfund` → Settings → Cron Jobs: make sure `/api/cron/daily` is listed and enabled. Open Logs, filter `/api/cron/daily`, look for errors. To run it by hand: `curl -H "Authorization: Bearer <CRON_SECRET from .env.local>" https://<your domain>/api/cron/daily`. |
| **"Some daily jobs need attention"** + a red job | One step (email, digest, cleanup, FIRST re-check, keepalive) failed last time. The detail says why. | Usually temporary (FIRST's API or Resend was down). If it's red two days in a row, send the error text to whoever maintains the code. |
| **"Refresh FIRST team list"** is red | The weekly copy of FIRST's team list failed (FIRST's API was down, or the `FIRST_API_USERNAME`/`FIRST_API_TOKEN` in Vercel are wrong). The team search on the setup page keeps the old copy, and a team's number still looks up directly, so coaches aren't blocked. | It retries every day on its own. If it stays red, check the two variables, then `npm run ftc:sync -- --remote` from your laptop. |
| **Emails in the last 24 h** is orange (≥80) or red (≥90) | Resend's free plan sends 100 emails a day. Sign-in codes always go first; everything else stops at 90. | One busy day is fine: email is delayed, never lost. If it's **80 or more most days**, upgrade to Resend Pro ($20/month) in Resend → Billing. No code change is needed. |
| **Queued email** has rows | Waiting to send, or retrying after a provider error (1, 2, 4, 8 minutes; 5 tries). | Nothing, unless a row is older than a day. **Send now** retries it; **Dismiss** drops it (the in-app notification was already delivered). |
| **Failed and bounced** has rows | The email copy didn't arrive (bad address, full inbox, marked as spam). The in-app notification still did. | If it's a coach or company contact, email them from ftcexodius@gmail.com to fix the address. Dismiss when handled. |
| **File storage** passes 800 MB of 1 GB | Decks, previews and logos. | Upgrade Supabase to Pro ($25/month), or ask a maintainer to move files to Cloudflare R2. Also watch **egress** (5 GB/month) on Supabase → Usage. |
| **Database** passes 400 MB of 500 MB | Pitches, notifications, email log. | Upgrade Supabase to Pro ($25/month). |

Vercel Hobby limits (1 million function calls, 4 CPU-hours a month) are far away; check Vercel → Usage once a month.

## Backups

Supabase's free plan keeps **no backups**. Once a week (and before any risky change):

```bash
npm run prod -- backup
```

It writes `backups/<date>/database.dump` (everything, including accounts) and `storage-objects.json` (the list of stored files). **The dump contains personal data**: copy the folder to the team drive, then delete the local copy. To restore, give the dump to a maintainer (`pg_restore` into a new Supabase project).

## Adding or removing an admin

The person must sign in once first (so their account exists). Then:

```bash
npm run prod -- admin new.person@example.com            # make admin
npm run prod -- admin old.person@example.com --revoke   # remove admin
```

An admin can also do this in the app: `/admin/directory` → People → ⋯ → Make admin / Remove admin access. Every change is recorded. Keep at least two admins.

## Rotating secrets

Rotate a secret when someone with access leaves, or if it may have leaked.

| Secret | How |
| --- | --- |
| **Supabase access, Vercel or Resend tokens** (used only by `npm run provision`) | Revoke the old token in that service's dashboard, create a new one, paste it into `.env.local`, then `npm run provision:check`. |
| **CRON_SECRET** | Delete the `CRON_SECRET=` line from `.env.local`, then `npm run provision:vercel` (makes a new one, updates Vercel, redeploys). |
| **Send Email hook secret** | Delete `SUPABASE_PRODUCTION_SEND_EMAIL_HOOK_SECRET=` (and the staging one) from `.env.local`, then `npm run provision:supabase -- --auth-only` and `npm run provision:vercel`. Sign-in codes may fail for a minute while the two sides update. |
| **Resend sending key** | Resend → API Keys: revoke `ftc-pitfund-app`. Delete `RESEND_SENDING_KEY=` from `.env.local`, then `npm run provision:resend`. |
| **Supabase secret key** | Supabase → Project Settings → API Keys: create a new secret key, delete the old one. Delete `SUPABASE_PRODUCTION_SECRET_KEY=` from `.env.local`, then `npm run provision:supabase` and `npm run provision:vercel`. |
| **Database password** | Supabase → Project Settings → Database → Reset password. Put it in `.env.local` as `SUPABASE_PRODUCTION_DB_PASSWORD`, delete the two `…DATABASE_URL=` lines, then `npm run provision:supabase` and `npm run provision:vercel`. |

After any rotation: `npm run provision:verify`.

## Handing over to a new captain

1. Change the ftcexodius@gmail.com password and 2-step verification to the new owner's phone; update the password manager.
2. GitHub: give the new captain admin on the `AnishYarrakonda/FTC-Pitfund` repo (or transfer it); remove graduates.
3. Supabase org, Resend team: invite the new captain; remove graduates.
4. Make them an admin (above); revoke graduates' admin access.
5. Rotate the tokens in `.env.local` (above) and give them the file through the password manager.
6. Walk through this runbook together once.

## When something goes wrong

**Sign-in codes don't arrive.** Check spam. Resend → Emails: look for the address. If nothing was sent, check Supabase → Authentication → Hooks (the Send Email hook must point at `https://<your domain>/api/auth/send-email`), then run `npm run provision:supabase -- --auth-only`.

**Emails stopped.** System page: if the 24-hour count is at 100, email is delayed until the window frees up (sign-in codes still go). Resend → Domains must show **Verified**; if DNS records were changed, re-add the records from `npm run provision:resend`. Resend → Emails shows provider errors.

**The site is down or says it can't reach the database.** Open `https://<your domain>/api/health`. If the database is `down`: Supabase → the `ftc-pitfund` project. A free project **pauses after a week without activity** (the daily job normally prevents this). Click **Restore project**, wait a few minutes, check `/api/health` again, then fix the daily job (System page). If Vercel itself is down, see [vercel-status.com](https://www.vercel-status.com).

**A deploy broke something.** Vercel → project → Deployments → pick the last good one → ⋯ → **Promote to Production**. That's instant. Then tell a maintainer.

**A report about a team or a person.** Suspend first if it involves photos of students or anything unsafe (the page disappears immediately), then investigate. For a person: `/admin/directory` → People → ⋯ → Suspend.

**Someone can't sign in.** Ask which email they use. `/admin/directory` → People: check they exist and aren't suspended. A 6-digit code expires in 10 minutes, and only the latest email's code works.

**Someone wants their data deleted.** They can delete their account at `/account`. If they can't sign in, suspend them and ask a maintainer to delete the account in Supabase → Authentication → Users (their memberships and notifications go with it).
