import { Section, Text } from 'react-email'
import { z } from 'zod'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'

import { EmailButton, EmailLayout, text } from './layout'

export const teamRejectedSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  note: z.string().min(1).max(5000),
  setupUrl: z.string().url(),
})

export type TeamRejectedProps = z.input<typeof teamRejectedSchema>

export function teamRejectedSubject(props: TeamRejectedProps) {
  return `Team ${props.teamNumber} wasn’t approved on FTC Pitfund`
}

export default function TeamRejectedEmail(props: TeamRejectedProps) {
  const p = teamRejectedSchema.parse(props)
  return (
    <EmailLayout preview={`We couldn’t approve Team ${p.teamNumber} yet. Here is why.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>
        Team {p.teamNumber} wasn’t approved
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>An FTC Pitfund admin reviewed {p.teamName} and couldn’t approve it. Their note:</Text>
      <Text style={{ ...text.body, color: '#061B31', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderLeft: '3px solid #E7E7EA', paddingLeft: '12px' }}>
        {p.note}
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        You can fix what they mentioned and send your team for review again. If you think this is a mistake, reply to this email or write to{' '}
        {SUPPORT_EMAIL}.
      </Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.setupUrl}>Update your team</EmailButton>
      </Section>
    </EmailLayout>
  )
}
