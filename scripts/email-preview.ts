/*
 * npm run email:preview
 *
 * Renders every email template (realistic data, plus a long-content variant with a 60-character
 * name and a 5,000-character unbroken word wherever the template shows user text) with the app's
 * own renderEmail(), sends each to the local Mailpit over the app's SMTP transport, then checks
 * what arrived through the Mailpit API: an HTML part, a non-empty text part, a subject, the
 * "FTC Pitfund <…>" sender, absolute links, and a text part without markup whose URLs sit on
 * their own lines. Each message is opened in Chromium at 600 and 375 px, screenshotted to
 * qa/emails/{template}[-long]-{width}.png and checked for horizontal scroll and overflowing text.
 *
 * Only touches messages it sent: recipients are email-preview+…@pitfund.test, and the previous
 * run's messages (same address pattern) are deleted first. Local stack only.
 */
import { mkdirSync, rmSync } from 'node:fs'

import { chromium } from '@playwright/test'

import { smtpTransport } from '@/lib/server/email/send'
import { renderEmail, type TemplateName, type TemplatePayload } from '@/lib/server/email/templates'

import { checkOverflow } from '../tests/qa/checks'

import { loadEnv } from './lib/env'

loadEnv()

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const SMTP_URL = process.env.SMTP_URL ?? 'smtp://127.0.0.1:54325'
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'FTC Pitfund <noreply@pitfund.test>'
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const OUT = 'qa/emails'
const WIDTHS = [600, 375] as const
const RECIPIENT_PREFIX = 'email-preview+'

const url = (path: string) => `${SITE}${path}`
const UUID = '6f1c2a4e-8b1d-4c1e-9a55-3d2f7c9e0b41'

/** A 60-character team or company name and a 5,000-character word with no break opportunity. */
const LONG_NAME = 'The Remarkably Persistent Robotics Collective of Springfield'.padEnd(60, 'x').slice(0, 60)
const LONG_WORD = 'Supercalifragilisticexpialidocious'.repeat(150).slice(0, 5000)
const long = (max: number) => LONG_WORD.slice(0, max)

type Sample = { [T in TemplateName]: { name: T; variant: 'default' | 'long' | 'quiet'; data: TemplatePayload<T> } }[TemplateName]

const samples: Sample[] = [
  { name: 'login-code', variant: 'default', data: { code: '482913', expiresInMinutes: 10 } },
  {
    name: 'notice',
    variant: 'default',
    data: {
      subject: 'Your team page is live',
      title: 'Your team page is live',
      paragraphs: ['Companies you pitch can now open Team 16225’s public page, with your deck and one-line summary.'],
      cta: { label: 'Open your team page', href: url('/t/16225') },
    },
  },
  {
    name: 'notice',
    variant: 'long',
    data: { subject: `Update for ${LONG_NAME}`, title: `Update for ${LONG_NAME}`, paragraphs: [long(2000)], cta: { label: 'Open FTC Pitfund', href: url('/') } },
  },
  {
    name: 'team-invite',
    variant: 'default',
    data: { teamNumber: 16225, teamName: 'Exodius', inviterName: 'Priya Raman', email: 'dana.lee@example.com', acceptUrl: url(`/invite/${UUID}`), expiresOn: 'September 28' },
  },
  {
    name: 'team-invite',
    variant: 'long',
    data: { teamNumber: 16225, teamName: LONG_NAME, inviterName: LONG_NAME, email: 'dana.lee@example.com', acceptUrl: url(`/invite/${UUID}`), expiresOn: 'September 28' },
  },
  {
    name: 'join-request',
    variant: 'default',
    data: { requesterName: 'Dana Lee', requesterEmail: 'dana.lee@example.com', teamNumber: 16225, teamName: 'Exodius', reviewUrl: url('/team') },
  },
  {
    name: 'join-request',
    variant: 'long',
    data: { requesterName: long(200), requesterEmail: 'dana.lee@example.com', teamNumber: 16225, teamName: LONG_NAME, reviewUrl: url('/team') },
  },
  { name: 'join-decision', variant: 'default', data: { approved: true, teamNumber: 16225, teamName: 'Exodius', url: url('/team') } },
  { name: 'join-decision', variant: 'long', data: { approved: false, teamNumber: 16225, teamName: LONG_NAME, url: url('/welcome') } },
  {
    name: 'admin-new-pitch',
    variant: 'default',
    data: {
      teamNumber: 16225,
      teamName: 'Exodius',
      verified: true,
      companyName: 'Ribosome Manufacturing',
      summary: 'Student-run FTC team building a mentoring program for middle schoolers.',
      ask: '$1,500 for competition fees and a CNC router bit set.',
      resubmission: false,
      reviewUrl: url(`/admin/pitches/${UUID}`),
    },
  },
  {
    name: 'admin-new-pitch',
    variant: 'long',
    data: { teamNumber: 16225, teamName: LONG_NAME, verified: false, companyName: LONG_NAME, summary: long(400), ask: long(700), resubmission: true, reviewUrl: url(`/admin/pitches/${UUID}`) },
  },
  {
    name: 'pitch-withdrawn',
    variant: 'default',
    data: { teamNumber: 16225, teamName: 'Exodius', companyName: 'Ribosome Manufacturing', inboxUrl: url(`/inbox/${UUID}`) },
  },
  { name: 'pitch-withdrawn', variant: 'long', data: { teamNumber: 16225, teamName: LONG_NAME, companyName: LONG_NAME, inboxUrl: url(`/inbox/${UUID}`) } },
  {
    name: 'match-team',
    variant: 'default',
    data: {
      teamNumber: 16225,
      companyName: 'Ribosome Manufacturing',
      contactName: 'Marcus Ortiz',
      contactTitle: 'Community Programs Manager',
      contactEmail: 'marcus.ortiz@ribosome.example',
      contactPhone: '(555) 201-4477',
      companyWebsite: 'https://ribosome.example',
      pitchUrl: url(`/pitches/${UUID}`),
    },
  },
  {
    name: 'match-team',
    variant: 'long',
    data: {
      teamNumber: 16225,
      companyName: LONG_NAME,
      contactName: long(200),
      contactTitle: long(5000),
      contactEmail: 'marcus.ortiz@ribosome.example',
      contactPhone: '(555) 201-4477 ext. 99999999999999999999',
      companyWebsite: `https://ribosome.example/${long(300)}`,
      pitchUrl: url(`/pitches/${UUID}`),
    },
  },
  {
    name: 'match-sponsor',
    variant: 'default',
    data: {
      teamNumber: 16225,
      teamName: 'Exodius',
      contactName: 'Priya Raman',
      contactEmail: 'priya.raman@example.com',
      contactPhone: null,
      teamUrl: url('/t/16225'),
      pitchUrl: url(`/inbox/${UUID}`),
    },
  },
  {
    name: 'match-sponsor',
    variant: 'long',
    data: {
      teamNumber: 16225,
      teamName: LONG_NAME,
      contactName: long(200),
      contactEmail: 'priya.raman@example.com',
      contactPhone: '(555) 201-4477',
      teamUrl: url('/t/16225'),
      pitchUrl: url(`/inbox/${UUID}`),
    },
  },
  {
    name: 'pitch-not-a-fit',
    variant: 'default',
    data: { teamNumber: 16225, companyName: 'Ribosome Manufacturing', reason: 'Our budget for this season is already committed to teams in our county.', pitchUrl: url(`/pitches/${UUID}`) },
  },
  { name: 'pitch-not-a-fit', variant: 'long', data: { teamNumber: 16225, companyName: LONG_NAME, reason: long(5000), pitchUrl: url(`/pitches/${UUID}`) } },
  { name: 'pitch-approved-coach', variant: 'default', data: { teamNumber: 16225, companyName: 'Ribosome Manufacturing', pitchUrl: url(`/pitches/${UUID}`) } },
  { name: 'pitch-approved-coach', variant: 'long', data: { teamNumber: 16225, companyName: LONG_NAME, pitchUrl: url(`/pitches/${UUID}`) } },
  {
    name: 'new-pitch-sponsor',
    variant: 'default',
    data: {
      teamNumber: 16225,
      teamName: 'Exodius',
      place: 'Austin, Texas',
      verified: true,
      companyName: 'Ribosome Manufacturing',
      summary: 'Student-run FTC team building a mentoring program for middle schoolers.',
      ask: '$1,500 for competition fees and a CNC router bit set.',
      inboxUrl: url(`/inbox/${UUID}`),
    },
  },
  {
    name: 'new-pitch-sponsor',
    variant: 'long',
    data: { teamNumber: 16225, teamName: LONG_NAME, place: long(200), verified: true, companyName: LONG_NAME, summary: long(400), ask: long(700), inboxUrl: url(`/inbox/${UUID}`) },
  },
  {
    name: 'pitch-sent-back',
    variant: 'default',
    data: {
      teamNumber: 16225,
      companyName: 'Ribosome Manufacturing',
      note: 'Ribosome asks how you would use the money. Please say what the $1,500 buys, and add your outreach numbers from last season.',
      editUrl: url(`/pitches/${UUID}/edit`),
    },
  },
  { name: 'pitch-sent-back', variant: 'long', data: { teamNumber: 16225, companyName: LONG_NAME, note: long(5000), editUrl: url(`/pitches/${UUID}/edit`) } },
  {
    name: 'pitch-rejected',
    variant: 'default',
    data: { teamNumber: 16225, companyName: 'Ribosome Manufacturing', note: 'The deck is for a different team number than your account.', pitchUrl: url(`/pitches/${UUID}`) },
  },
  { name: 'pitch-rejected', variant: 'long', data: { teamNumber: 16225, companyName: LONG_NAME, note: long(5000), pitchUrl: url(`/pitches/${UUID}`) } },
  { name: 'team-approved', variant: 'default', data: { teamNumber: 16225, teamName: 'Exodius', pitchesUrl: url('/pitches') } },
  { name: 'team-approved', variant: 'long', data: { teamNumber: 16225, teamName: LONG_NAME, pitchesUrl: url('/pitches') } },
  {
    name: 'team-rejected',
    variant: 'default',
    data: {
      teamNumber: 16225,
      teamName: 'Exodius',
      note: 'The screenshot doesn’t show your name on the roster. Send the FIRST Dashboard page that lists your team’s coaches.',
      setupUrl: url('/welcome/team'),
    },
  },
  { name: 'team-rejected', variant: 'long', data: { teamNumber: 16225, teamName: LONG_NAME, note: long(5000), setupUrl: url('/welcome/team') } },
  { name: 'sponsor-approved', variant: 'default', data: { companyName: 'Ribosome Manufacturing', companyUrl: url('/company') } },
  { name: 'sponsor-approved', variant: 'long', data: { companyName: LONG_NAME, companyUrl: url('/company') } },
  {
    name: 'sponsor-rejected',
    variant: 'default',
    data: { companyName: 'Ribosome Manufacturing', note: 'We couldn’t confirm the company’s website. Add a working link and a short description.', inboxUrl: url('/company') },
  },
  { name: 'sponsor-rejected', variant: 'long', data: { companyName: LONG_NAME, note: long(5000), inboxUrl: url('/company') } },
  {
    name: 'sponsor-invite',
    variant: 'default',
    data: { companyName: 'Ribosome Manufacturing', inviterName: 'Marcus Ortiz', email: 'jen.wu@ribosome.example', acceptUrl: url(`/invite/${UUID}`), expiresOn: 'September 28' },
  },
  {
    name: 'sponsor-invite',
    variant: 'long',
    data: { companyName: LONG_NAME, inviterName: long(200), email: 'jen.wu@ribosome.example', acceptUrl: url(`/invite/${UUID}`), expiresOn: 'September 28' },
  },
  {
    name: 'admin-report',
    variant: 'default',
    data: {
      teamNumber: 16225,
      teamName: 'Exodius',
      reason: 'Not a real team',
      details: 'The team number belongs to a team in Ohio, but this page says Texas.',
      reporter: 'marcus.ortiz@ribosome.example',
      reviewUrl: url(`/admin/teams/${UUID}`),
    },
  },
  {
    name: 'admin-report',
    variant: 'long',
    data: { teamNumber: 16225, teamName: LONG_NAME, reason: long(200), details: long(2000), reporter: null, reviewUrl: url(`/admin/teams/${UUID}`) },
  },
  {
    name: 'admin-digest',
    variant: 'default',
    data: {
      dateLabel: 'Monday, September 14',
      newTeams: [
        { number: 16225, name: 'Exodius', place: 'Austin, Texas', url: url(`/admin/teams/${UUID}`) },
        { number: 23017, name: 'Voltage', place: null, url: url(`/admin/teams/${UUID}`) },
      ],
      newTeamsTotal: 2,
      pendingCompanies: [{ name: 'Ribosome Manufacturing', applicant: 'Marcus Ortiz', url: url(`/admin/companies/${UUID}`) }],
      pendingCompaniesTotal: 1,
      openReports: 1,
      waitingPitches: 3,
      oldestWaitingHours: 41,
      reviewUrl: url('/admin'),
      newUsers: 5,
      activity: [
        { label: 'Teams submitted for review', count: 2 },
        { label: 'Pitches submitted', count: 4 },
        { label: 'Pitches matched', count: 1 },
      ],
      email: {
        sent24h: 83,
        limit: 100,
        failed24h: 1,
        bounced24h: 0,
        waiting: 2,
        sentThisMonth: 611,
        byKind: [
          { label: 'login code', count: 41 },
          { label: 'new pitch sponsor', count: 18 },
          { label: 'pitch approved coach', count: 12 },
          { label: 'admin digest', count: 2 },
        ],
      },
      warnAt: 80,
    },
  },
  {
    name: 'admin-digest',
    variant: 'quiet',
    data: {
      dateLabel: 'Tuesday, September 15',
      newTeams: [],
      newTeamsTotal: 0,
      pendingCompanies: [],
      pendingCompaniesTotal: 0,
      openReports: 0,
      waitingPitches: 0,
      oldestWaitingHours: null,
      reviewUrl: url('/admin'),
      newUsers: 0,
      activity: [],
      email: { sent24h: 3, limit: 100, failed24h: 0, bounced24h: 0, waiting: 0, sentThisMonth: 96, byKind: [{ label: 'login code', count: 3 }] },
      warnAt: 80,
    },
  },
  {
    name: 'admin-digest',
    variant: 'long',
    data: {
      dateLabel: 'Wednesday, September 30',
      newTeams: [{ number: 16225, name: long(200), place: long(200), url: url(`/admin/teams/${UUID}`) }],
      newTeamsTotal: 14,
      pendingCompanies: [{ name: LONG_NAME, applicant: long(200), url: url(`/admin/companies/${UUID}`) }],
      pendingCompaniesTotal: 12,
      openReports: 3,
      waitingPitches: 27,
      oldestWaitingHours: 130,
      reviewUrl: url('/admin'),
      newUsers: 240,
      activity: [{ label: long(60), count: 999 }],
      email: {
        sent24h: 97,
        limit: 100,
        failed24h: 12,
        bounced24h: 3,
        waiting: 40,
        sentThisMonth: 2740,
        byKind: [{ label: long(60), count: 97 }],
      },
      warnAt: 80,
    },
  },
]

type MailpitAddress = { Name: string; Address: string }
type MailpitSummary = { ID: string; To: MailpitAddress[] }
type MailpitMessage = { ID: string; Subject: string; From: MailpitAddress; HTML: string; Text: string }

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MAILPIT}${path}`, init)
  if (!res.ok) throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path} → ${res.status}`)
  const body = await res.text()
  // DELETE answers a bare "ok".
  return (body.startsWith('{') || body.startsWith('[') ? JSON.parse(body) : null) as T
}

async function findPreviewMessages(): Promise<MailpitSummary[]> {
  const query = encodeURIComponent(`to:"${RECIPIENT_PREFIX}"`)
  const found = await mailpit<{ messages: MailpitSummary[] }>(`/api/v1/search?query=${query}&limit=1000`)
  return found.messages.filter((m) => m.To.some((t) => t.Address.startsWith(RECIPIENT_PREFIX)))
}

/** Checks on what Mailpit received. Returns failure messages. */
function checkMessage(msg: MailpitMessage): string[] {
  const failures: string[] = []
  if (!msg.HTML.trim()) failures.push('no HTML part')
  if (!msg.Text.trim()) failures.push('empty text part')
  if (!msg.Subject.trim()) failures.push('no subject')
  if (msg.From.Name !== 'FTC Pitfund' || !msg.From.Address) failures.push(`from is "${msg.From.Name} <${msg.From.Address}>"`)
  for (const [, href] of msg.HTML.matchAll(/\shref="([^"]*)"/g)) {
    if (!/^(https?:\/\/[^/\s]+|mailto:[^\s@]+@[^\s@]+)/.test(href)) failures.push(`relative or empty link: "${href.slice(0, 80)}"`)
  }
  if (/<\/?[a-z][a-z0-9]*[\s>/]/i.test(msg.Text)) failures.push('text part contains markup')
  for (const line of msg.Text.split('\n')) {
    const urls = line.match(/https?:\/\/\S+/g) ?? []
    if (urls.length && (urls.length > 1 || line.trim() !== urls[0])) failures.push(`text URL shares a line: "${line.trim().slice(0, 100)}"`)
  }
  if (/dispatch|submission|token|supabase|\bRLS\b/i.test(msg.Text.replace(/https?:\/\/\S+/g, ''))) failures.push('jargon in copy')
  if (!msg.Text.includes('ftcexodius@gmail.com')) failures.push('no support email')
  if (!msg.Text.includes('Not affiliated with or endorsed by FIRST®')) failures.push('no FIRST disclaimer')
  return failures
}

async function main() {
  const mailpitHost = new URL(MAILPIT).hostname
  if (!['127.0.0.1', 'localhost'].includes(mailpitHost) || !/^smtp:\/\/(127\.0\.0\.1|localhost)[:/]/.test(SMTP_URL)) {
    throw new Error('email:preview only sends to the local Mailpit.')
  }

  const stale = await findPreviewMessages()
  if (stale.length) {
    await mailpit('/api/v1/messages', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: stale.map((m) => m.ID) }) })
  }

  const runId = Date.now().toString(36)
  const transport = smtpTransport(SMTP_URL, EMAIL_FROM)
  const sent: Array<{ file: string; to: string }> = []
  for (const sample of samples) {
    const file = sample.variant === 'default' ? sample.name : `${sample.name}-${sample.variant}`
    const to = `${RECIPIENT_PREFIX}${file}-${runId}@pitfund.test`
    const rendered = await renderEmail(sample.name, sample.data)
    await transport.send({ id: `preview-${runId}-${file}`, to, ...rendered })
    sent.push({ file, to })
  }
  console.log(`▸ Sent ${sent.length} emails to Mailpit (${MAILPIT})`)

  // Wait for Mailpit to index every message.
  let received: MailpitSummary[] = []
  for (let i = 0; i < 50; i++) {
    received = (await findPreviewMessages()).filter((m) => m.To.some((t) => t.Address.endsWith(`-${runId}@pitfund.test`)))
    if (received.length >= sent.length) break
    await new Promise((r) => setTimeout(r, 200))
  }

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const problems: string[] = []
  try {
    for (const { file, to } of sent) {
      const summary = received.find((m) => m.To.some((t) => t.Address === to))
      if (!summary) {
        problems.push(`${file}: never arrived in Mailpit`)
        continue
      }
      const msg = await mailpit<MailpitMessage>(`/api/v1/message/${summary.ID}`)
      const failures = checkMessage(msg)

      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
        await context.addInitScript('globalThis.__name = (fn) => fn')
        const page = await context.newPage()
        await page.goto(`${MAILPIT}/view/${summary.ID}.html`, { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        for (const f of await checkOverflow(page)) failures.push(`${width}px: ${f}`)
        await page.screenshot({ path: `${OUT}/${file}-${width}.png`, fullPage: true })
        await context.close()
      }

      if (failures.length) problems.push(...failures.map((f) => `${file}: ${f}`))
      console.log(`${failures.length ? '✗' : '✓'} ${file.padEnd(26)} ${msg.Subject.slice(0, 90)}`)
    }
  } finally {
    await browser.close()
  }

  console.log(`\nScreenshots in ${OUT}/ · Mailpit ${MAILPIT}`)
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
