import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const pitchRejectedSchema = z.object({
  teamNumber: z.number().int().positive(),
  companyName: z.string().min(1).max(200),
  note: z.string().max(5000).nullable(),
  pitchUrl: z.string().url(),
})

export type PitchRejectedProps = z.input<typeof pitchRejectedSchema>

export function pitchRejectedSubject(props: PitchRejectedProps) {
  return `Your pitch to ${props.companyName} wasn’t approved`
}

export default function PitchRejectedEmail(props: PitchRejectedProps) {
  const p = pitchRejectedSchema.parse(props)
  return (
    <EmailLayout preview={`A reviewer didn’t approve Team ${p.teamNumber}’s pitch to ${p.companyName}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>Your pitch to {p.companyName} wasn’t approved</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        A reviewer read Team {p.teamNumber}’s pitch and didn’t send it to {p.companyName}.{p.note ? ' Their note:' : ''}
      </Text>
      {p.note ? (
        <Text style={{ ...text.body, color: '#0B0B0C', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderLeft: '3px solid #E7E7EA', paddingLeft: '12px' }}>{p.note}</Text>
      ) : null}
      <Text style={text.body}>You’re welcome to pitch other companies this season.</Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.pitchUrl}>Open the pitch</EmailButton>
      </Section>
    </EmailLayout>
  )
}
