import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const pitchSentBackSchema = z.object({
  teamNumber: z.number().int().positive(),
  companyName: z.string().min(1).max(200),
  note: z.string().min(1).max(5000),
  editUrl: z.string().url(),
})

export type PitchSentBackProps = z.input<typeof pitchSentBackSchema>

export function pitchSentBackSubject(props: PitchSentBackProps) {
  return `Changes requested on your pitch to ${props.companyName}`
}

export default function PitchSentBackEmail(props: PitchSentBackProps) {
  const p = pitchSentBackSchema.parse(props)
  return (
    <EmailLayout preview={`A reviewer asked for changes before sending Team ${p.teamNumber}’s pitch to ${p.companyName}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>A reviewer asked for changes</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        Team {p.teamNumber}’s pitch to {p.companyName} hasn’t been sent yet. Edit it with this note in mind, then resubmit:
      </Text>
      <Text style={{ ...text.body, color: '#061B31', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderLeft: '3px solid #E7E7EA', paddingLeft: '12px' }}>{p.note}</Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.editUrl}>Edit and resubmit</EmailButton>
      </Section>
    </EmailLayout>
  )
}
