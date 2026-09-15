import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const pitchApprovedCoachSchema = z.object({
  teamNumber: z.number().int().positive(),
  companyName: z.string().min(1).max(200),
  pitchUrl: z.string().url(),
})

export type PitchApprovedCoachProps = z.input<typeof pitchApprovedCoachSchema>

export function pitchApprovedCoachSubject(props: PitchApprovedCoachProps) {
  return `Your pitch to ${props.companyName} was sent`
}

export default function PitchApprovedCoachEmail(props: PitchApprovedCoachProps) {
  const p = pitchApprovedCoachSchema.parse(props)
  return (
    <EmailLayout preview={`A reviewer approved Team ${p.teamNumber}’s pitch. ${p.companyName} can read it now.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>Your pitch to {p.companyName} was sent</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        A reviewer approved Team {p.teamNumber}’s pitch and sent it to {p.companyName}. We’ll email you when they respond.
      </Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.pitchUrl}>Open the pitch</EmailButton>
      </Section>
    </EmailLayout>
  )
}
