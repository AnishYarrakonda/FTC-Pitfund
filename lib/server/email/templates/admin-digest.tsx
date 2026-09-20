import { Link, Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, emailColors, EmailLayout, text } from './layout'

/** The daily summary (priority 3), sent every day: email volume first, then activity, then what's waiting. */
export const adminDigestSchema = z.object({
  dateLabel: z.string().min(1).max(40),
  newTeams: z.array(z.object({ number: z.number().int(), name: z.string().max(200), place: z.string().max(200).nullable(), url: z.string().url() })).max(10),
  newTeamsTotal: z.number().int().min(0),
  pendingCompanies: z.array(z.object({ name: z.string().max(200), applicant: z.string().max(200).nullable(), url: z.string().url() })).max(10),
  pendingCompaniesTotal: z.number().int().min(0),
  openReports: z.number().int().min(0),
  waitingPitches: z.number().int().min(0),
  oldestWaitingHours: z.number().int().min(0).nullable(),
  reviewUrl: z.string().url(),
  newUsers: z.number().int().min(0),
  activity: z.array(z.object({ label: z.string().max(80), count: z.number().int().min(0) })).max(12),
  email: z.object({
    sent24h: z.number().int().min(0),
    limit: z.number().int().min(1),
    failed24h: z.number().int().min(0),
    bounced24h: z.number().int().min(0),
    waiting: z.number().int().min(0),
    sentThisMonth: z.number().int().min(0),
    byKind: z.array(z.object({ label: z.string().max(60), count: z.number().int().min(0) })).max(8),
  }),
  warnAt: z.number().int().min(1),
})

export type AdminDigestProps = z.input<typeof adminDigestSchema>

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function adminDigestSubject(props: AdminDigestProps) {
  const waiting = [
    props.waitingPitches ? plural(props.waitingPitches, 'pitch', 'pitches') + ' waiting' : null,
    props.pendingCompaniesTotal ? plural(props.pendingCompaniesTotal, 'company', 'companies') + ' to approve' : null,
    props.newTeamsTotal ? plural(props.newTeamsTotal, 'team') + ' to approve' : null,
    props.openReports ? plural(props.openReports, 'report') : null,
  ].filter(Boolean)
  const volume = `${props.email.sent24h}/${props.email.limit} emails`
  return `FTC Pitfund daily: ${[volume, ...waiting].join(', ')}`
}

const heading = { ...text.body, color: emailColors.text, fontWeight: 600, margin: '20px 0 6px' }
const item = { ...text.body, margin: '0 0 4px', wordBreak: 'break-word' as const }
const big = { ...text.h1, margin: '0 0 4px' }

export default function AdminDigestEmail(props: AdminDigestProps) {
  const p = adminDigestSchema.parse(props)
  const { email } = p
  const nearLimit = email.sent24h >= p.warnAt
  const nothingWaiting = !p.waitingPitches && !p.pendingCompaniesTotal && !p.newTeamsTotal && !p.openReports
  return (
    <EmailLayout preview={adminDigestSubject(p).replace('FTC Pitfund daily: ', '')}>
      <Text style={text.h1}>Daily summary, {p.dateLabel}</Text>

      <Text style={heading}>Emails sent in the last 24 hours</Text>
      <Text style={big}>
        {email.sent24h} of {email.limit}
      </Text>
      {nearLimit ? (
        <Text style={{ ...item, color: emailColors.text, fontWeight: 600 }}>
          This is close to Resend’s free daily limit of {email.limit}. Upgrade to Resend Pro in Resend → Billing before it starts delaying email.
        </Text>
      ) : null}
      <Text style={item}>{plural(email.sentThisMonth, 'email')} so far this month.</Text>
      {email.byKind.map((k) => (
        <Text key={k.label} style={item}>
          {k.count} · {k.label}
        </Text>
      ))}
      {email.failed24h || email.bounced24h ? (
        <Text style={item}>
          Problems: {plural(email.failed24h, 'email')} failed, {plural(email.bounced24h, 'email')} bounced. Details are on the System page.
        </Text>
      ) : null}
      {email.waiting ? <Text style={item}>{plural(email.waiting, 'email')} waiting to be sent.</Text> : null}

      <Text style={heading}>What happened in the last 24 hours</Text>
      {p.newUsers || p.activity.length ? (
        <>
          {p.newUsers ? <Text style={item}>{plural(p.newUsers, 'person', 'people')} signed up.</Text> : null}
          {p.activity.map((a) => (
            <Text key={a.label} style={item}>
              {a.count} · {a.label}
            </Text>
          ))}
        </>
      ) : (
        <Text style={item}>A quiet day. Nothing new.</Text>
      )}

      <Text style={heading}>Waiting for you</Text>
      {nothingWaiting ? <Text style={item}>Nothing is waiting. You’re all caught up.</Text> : null}
      {p.waitingPitches ? (
        <Text style={item}>
          Pitches waiting more than a day: {p.waitingPitches}
          {p.oldestWaitingHours ? ` (the oldest has waited ${p.oldestWaitingHours} hours)` : ''}.
        </Text>
      ) : null}
      {p.pendingCompaniesTotal ? (
        <>
          <Text style={item}>Companies to approve: {p.pendingCompaniesTotal}</Text>
          {p.pendingCompanies.map((c) => (
            <Text key={c.url} style={item}>
              <Link href={c.url} style={{ color: emailColors.accent }}>
                {c.name}
              </Link>
              {c.applicant ? ` · ${c.applicant}` : ''}
            </Text>
          ))}
        </>
      ) : null}
      {p.newTeamsTotal ? (
        <>
          <Text style={item}>Teams to approve: {p.newTeamsTotal}</Text>
          {p.newTeams.map((t) => (
            <Text key={t.url} style={item}>
              <Link href={t.url} style={{ color: emailColors.accent }}>
                Team {t.number} · {t.name}
              </Link>
              {t.place ? ` · ${t.place}` : ''}
            </Text>
          ))}
        </>
      ) : null}
      {p.openReports ? <Text style={item}>Open reports: {p.openReports}</Text> : null}

      <Section style={{ padding: '20px 0 0' }}>
        <EmailButton href={p.reviewUrl}>Open the review queue</EmailButton>
      </Section>
    </EmailLayout>
  )
}
