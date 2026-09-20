# Launching FTC Pitfund

This is the only launch document. Every step here needs a person: creating accounts, paying for the domain and DNS. Everything else is `npm run provision`. It creates the production and staging Supabase projects, applies migrations, creates storage buckets, configures sign-in and the Send Email hook, seeds staging and grants admins. It creates the Vercel project connected to GitHub with every environment variable, adds the domain, and sets up the Resend sending domain, webhook and a sending-only key. Every step is idempotent: re-run it after each human step and it picks up where it stopped. It never touches the v1 app (the personal Vercel project `ftc-sponsorship-portal`, Clerk or Supabase `qqizqbtwigyedgskoezm`).

All infrastructure belongs to the owner Google account (`OWNER_EMAIL` in `.env.local`). Do every step while signed in as that account.

| `npm run provision*` exit code | Meaning |
| --- | --- |
| `0` | Done. Nothing is waiting. |
| `2` | Waiting on you. The last lines say exactly what to do. Do it, then run the same command again. |
| `1` | Something failed. The error says what; nothing was left half-done. Fix it and run the command again. |

Before starting: a computer with Node 24 (what CI and Vercel build with), Docker (only for local development), the [GitHub CLI](https://cli.github.com) and this repository cloned (`npm install`).

---

## 1. Create the accounts

Open a private browser window signed in only to the owner account, then create:

| Service | What to create | Plan |
| --- | --- | --- |
| [GitHub](https://github.com) | Nothing to create: the repo is `AnishYarrakonda/FTC-Pitfund`. Sign in with `gh auth login`. | Free |
| [Vercel](https://vercel.com/signup) | Sign up with the owner email or GitHub. | Hobby (free) |
| [Supabase](https://supabase.com/dashboard) | Sign up with the owner email. Supabase creates a personal organization for you; use it (no new organization). | Free |
| [Resend](https://resend.com/signup) | Sign up with the owner email. | Free |

Everything is personal: no organizations or teams. Put every login in your password manager.

**Done when:** you can open each dashboard as the owner account, and `gh auth login` works with the GitHub account that owns the repo.

## 2. Create the tokens

1. `cp .env.example .env.local` (gitignored; never commit it).
2. Paste these into `.env.local`:

| Variable | Where |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → [Access Tokens](https://supabase.com/dashboard/account/tokens) → Generate new token, name `ftc-pitfund-provision` |
| `VERCEL_TOKEN` | Vercel → Account Settings → [Tokens](https://vercel.com/account/settings/tokens) → Create, scope: your Hobby team, name `ftc-pitfund-provision` |
| `RESEND_FULL_ACCESS_KEY` | Resend → [API Keys](https://resend.com/api-keys) → Create API key, permission **Full access** (the app itself gets a separate sending-only key) |

3. Run `npm run provision:check`.

**Done when:** `provision:check` shows each token belongs to `OWNER_EMAIL` and prints no warning in capitals.

## 3. Buy the domain

The app needs its own domain (exodiusftc.com stays the team website). Suggested: **ftcpitfund.org** or **ftcpitfund.com**. Both were unregistered on 2026-09-14, so check again before buying. Pick an at-cost registrar:

| Registrar | .com per year | .org per year | Notes |
| --- | --- | --- | --- |
| [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) | $10.44 (rises to about $11.15 on Nov 1, 2026) | at cost | No markup. The domain must use Cloudflare DNS; add Vercel's records there with the proxy **off** ("DNS only"). |
| [Porkbun](https://porkbun.com/products/domains) | $11.08, renews $11.08 | $7.98 first year, renews $11.84 | Free WHOIS privacy; DNS managed at Porkbun. |

Prices checked 2026-09-14 ([Cloudflare](https://tld-list.com/registrars/cloudflare), [Porkbun](https://porkbun.com/products/domains)). Turn off any add-ons (email hosting, site builders). WHOIS privacy should be on.

Then set `PITFUND_DOMAIN=ftcpitfund.org` (your domain, no `https://`) in `.env.local`.

**Done when:** `npm run provision:check` says the domain is registered.

## 4. Run the provisioner

```bash
npm run provision
```

It runs Supabase, Vercel and Resend in order and stops (exit 2) when it needs you. Expect to come back here two or three times:

- **"Connect GitHub"**: install the Vercel GitHub app on your GitHub account: [github.com/apps/vercel](https://github.com/apps/vercel) → Configure → AnishYarrakonda → Only select repositories → `FTC-Pitfund`. Re-run.
- **"Add these DNS records"**: step 6.

**Done when:** `npm run provision` ends with "Everything that can be automated is done" (exit 0).

It creates three storage buckets: `public` (decks, logos and previews, served to anyone), `staging`
(private, holds a file for the minutes between the browser uploading it and the server checking it,
emptied daily) and **`verification`** (private, holds the FIRST Dashboard screenshot each coach
uploads to prove they coach their team). `verification` is never emptied and must never be made
public — an admin reads a screenshot through a link that expires in 15 minutes. If you ever recreate
a bucket by hand in the Supabase dashboard, leave "Public bucket" off for those two.

## 5. Sign-in

Nothing to set up. Sign-in is a 6-digit code sent by email through Resend (no Google or other provider), so it starts working once the Resend domain is verified in step 6.

## 6. DNS records

At your registrar's DNS settings, add exactly the records the scripts printed. They look like this:

| For | Type | Name | Value |
| --- | --- | --- | --- |
| Vercel (site) | `A` | `@` | the IP printed by `provision:vercel` (currently `76.76.21.21`) |
| Vercel (www) | `CNAME` | `www` | the value printed (for example `cname.vercel-dns.com`) |
| Resend (DKIM) | `TXT` | `resend._domainkey` | the long `p=…` value printed by `provision:resend` |
| Resend (SPF, bounces) | `MX` | `send` | `feedback-smtp.us-east-1.amazonses.com`, priority 10 |
| Resend (SPF) | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` |
| DMARC | `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:ftcexodius@gmail.com` |

On Cloudflare, set the proxy status of the Vercel records to **DNS only** (grey cloud). Then run `npm run provision` again. It waits for Vercel to see the domain and asks Resend to verify it.

**Done when:** `npm run provision` exits 0, `https://<your domain>` loads with a valid certificate, and Resend → Domains shows the domain as **Verified**. DNS can take up to an hour.

## 7. Verify production

```bash
npm run provision:verify
```

It checks the site, security headers, the email-code sign-in page, that `/dev` is unreachable, robots and sitemap, the daily job with and without its secret, and sends a test email through the outbox.

**Done when:** it exits 0 and the `OWNER_EMAIL` inbox has **"FTC Pitfund is live: test email"** (check spam; mark it "Not spam").

If Vercel shows the production deployment as **Canceled** with "Ignored Build Step", the project isn't exposing system environment variables to builds: Vercel → project → Settings → Environment Variables → turn on **Automatically expose System Environment Variables** → Deployments → Redeploy. (`npm run provision:vercel` turns it on; this only happens if it was switched off.)

Then sign in at `https://<your domain>/login` with `OWNER_EMAIL` (or any address in `ADMIN_EMAILS`). The admin console is at `/admin`. Day-to-day operation is in [RUNBOOK.md](RUNBOOK.md).

## 8. Legal review

`/legal/terms` and `/legal/privacy` are plain-language drafts. Have a qualified person (a parent who is a lawyer, a school district contact, a mentor company's counsel) read both. The text lives in the `SECTIONS` array in `app/(public)/legal/*/page.tsx`; change it there and update the "Last updated" date. Each section has a stable `id`, so a reviewer can point at `/legal/terms#shared-accounts`.

Give the reviewer these four, which the code can't settle:

1. **Which law applies, and where a dispute goes.** Neither page says. Every other site this size names a state.
2. **A copyright-complaint route.** "Reports, removal and suspension" covers a bad team page; it doesn't tell a company whose logo was used how to ask for it to come down, or name an agent.
3. **Whether accepting once is enough.** We record the moment someone accepts (`users.accepted_terms_at`) but not *which version*, and nothing re-prompts when the text changes — the Terms just say continued use is acceptance. If the reviewer wants recorded re-acceptance, that is a version constant plus a gate in the app shell.
4. **Whether a volunteer team can disclaim liability the way "No warranty" does**, given the users are adults acting for schools and companies.

**Done when:** the reviewer signs off, those four are answered, and the "Plain-language draft" comment is removed from both files.

## 9. Retire v1, only after v2 is live

**Do this only after Anish confirms v2 is working in production.** These steps delete the old app. Nothing in the rebuild has touched it.

1. **Final backup of the v1 database.** Supabase dashboard → project `qqizqbtwigyedgskoezm` → Database → Backups (or `pg_dump` with its connection string). Save it to the team drive.
2. **Vercel (personal account).** Project `ftc-sponsorship-portal` → Settings → Domains: remove any domains, then Settings → Advanced → **Delete Project**. (This project is still connected to the GitHub repository. Until it is deleted, `vercel.json`'s ignored build step (`scripts/vercel-ignore-build.mjs`) skips every push it receives, so v2 never deploys there.)
3. **Clerk.** dashboard.clerk.com → the FTC Sponsorship Portal application → Settings → **Delete application**.
4. **Supabase v1.** Project `qqizqbtwigyedgskoezm` → Settings → General → **Pause project**, and a month later **Delete project**.
5. **Personal Resend.** Resend → Domains: delete the v1 domain. API Keys: revoke the v1 keys.
6. Delete `../_v1-local-archive-2026-09-13/` (it holds v1 production secrets) once the steps above are done.

The v1 code stays in git at tag `legacy-v1`; don't delete the tag.

**Done when:** none of the v1 services appear in the personal accounts, and v2 is still green (`npm run provision:verify`).
