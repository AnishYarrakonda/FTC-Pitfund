import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailFacts, EmailLayout, text } from './layout'

export const adminReportSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  reason: z.string().min(1).max(200),
  details: z.string().max(2000).nullable(),
  reporter: z.string().max(200).nullable(),
  reviewUrl: z.string().url(),
})

export type AdminReportProps = z.input<typeof adminReportSchema>

export function adminReportSubject(props: AdminReportProps) {
  return `Report: Team ${props.teamNumber} · ${props.teamName}`
}

export default function AdminReportEmail(props: AdminReportProps) {
  const p = adminReportSchema.parse(props)
  return (
    <EmailLayout preview={`Someone reported Team ${p.teamNumber}’s public page: ${p.reason}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>A team page was reported</Text>
      <EmailFacts
        rows={[
          ['Team', `Team ${p.teamNumber} · ${p.teamName}`],
          ['Reason', p.reason],
          ['Details', p.details || 'None given'],
          ['Reported by', p.reporter || 'Anonymous visitor'],
        ]}
      />
      <Section style={{ padding: '0 0 16px' }}>
        <EmailButton href={p.reviewUrl}>Review the report</EmailButton>
      </Section>
      <Text style={text.small}>The page stays up until an admin suspends the team.</Text>
    </EmailLayout>
  )
}
