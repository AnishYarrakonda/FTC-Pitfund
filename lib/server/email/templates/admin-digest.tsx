import { Link, Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, emailColors, EmailLayout, text } from './layout'

/** The daily admin summary (priority 3): what's waiting. Sent only when something is. */
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
})

export type AdminDigestProps = z.input<typeof adminDigestSchema>

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function adminDigestSubject(props: AdminDigestProps) {
  const parts = [
    props.waitingPitches ? plural(props.waitingPitches, 'pitch', 'pitches') + ' waiting' : null,
    props.pendingCompaniesTotal ? plural(props.pendingCompaniesTotal, 'company', 'companies') + ' to approve' : null,
    props.newTeamsTotal ? plural(props.newTeamsTotal, 'new team') : null,
    props.openReports ? plural(props.openReports, 'report') : null,
  ].filter(Boolean)
  return `FTC Pitfund daily: ${parts.join(', ')}`
}

const heading = { ...text.body, color: emailColors.text, fontWeight: 600, margin: '20px 0 6px' }
const item = { ...text.body, margin: '0 0 4px', wordBreak: 'break-word' as const }

export default function AdminDigestEmail(props: AdminDigestProps) {
  const p = adminDigestSchema.parse(props)
  return (
    <EmailLayout preview={adminDigestSubject(p).replace('FTC Pitfund daily: ', '')}>
      <Text style={text.h1}>What’s waiting, {p.dateLabel}</Text>
      {p.waitingPitches ? (
        <>
          <Text style={heading}>Pitches waiting more than a day: {p.waitingPitches}</Text>
          <Text style={item}>{p.oldestWaitingHours ? `The oldest has waited ${p.oldestWaitingHours} hours.` : null}</Text>
        </>
      ) : null}
      {p.pendingCompaniesTotal ? (
        <>
          <Text style={heading}>Companies to approve: {p.pendingCompaniesTotal}</Text>
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
          <Text style={heading}>New teams to verify: {p.newTeamsTotal}</Text>
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
      {p.openReports ? <Text style={heading}>Open reports: {p.openReports}</Text> : null}
      <Section style={{ padding: '20px 0 0' }}>
        <EmailButton href={p.reviewUrl}>Open the review queue</EmailButton>
      </Section>
    </EmailLayout>
  )
}
