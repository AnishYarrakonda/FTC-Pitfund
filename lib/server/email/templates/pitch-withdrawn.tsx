import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const pitchWithdrawnSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  inboxUrl: z.string().url(),
})

export type PitchWithdrawnProps = z.input<typeof pitchWithdrawnSchema>

export function pitchWithdrawnSubject(props: PitchWithdrawnProps) {
  return `Team ${props.teamNumber} withdrew its pitch`
}

export default function PitchWithdrawnEmail(props: PitchWithdrawnProps) {
  const p = pitchWithdrawnSchema.parse(props)
  return (
    <EmailLayout preview={`Team ${p.teamNumber} · ${p.teamName} withdrew its pitch to ${p.companyName}. Nothing to do.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>
        Team {p.teamNumber} · {p.teamName} withdrew its pitch
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        The team withdrew the pitch it sent to {p.companyName}, so you don&apos;t need to respond. The link below shows it as
        withdrawn.
      </Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.inboxUrl}>View the pitch</EmailButton>
      </Section>
    </EmailLayout>
  )
}
