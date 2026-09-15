import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailFacts, EmailLayout, text } from './layout'

export const adminNewPitchSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  verified: z.boolean(),
  companyName: z.string().min(1).max(200),
  summary: z.string().max(400).nullable(),
  ask: z.string().max(700).nullable(),
  resubmission: z.boolean().default(false),
  reviewUrl: z.string().url(),
})

export type AdminNewPitchProps = z.input<typeof adminNewPitchSchema>

export function adminNewPitchSubject(props: AdminNewPitchProps) {
  return `${props.resubmission ? 'Resubmitted' : 'New'} pitch: Team ${props.teamNumber} → ${props.companyName}`
}

export default function AdminNewPitchEmail(props: AdminNewPitchProps) {
  const p = adminNewPitchSchema.parse(props)
  return (
    <EmailLayout preview={`Team ${p.teamNumber} · ${p.teamName} pitched ${p.companyName}. It's waiting for review.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>
        {p.resubmission ? 'A pitch was resubmitted' : 'A new pitch is waiting for review'}
      </Text>
      <EmailFacts
        rows={[
          ['Team', `Team ${p.teamNumber} · ${p.teamName} (${p.verified ? 'verified' : 'not verified yet'})`],
          ['Company', p.companyName],
          ['One-line summary', p.summary || 'No summary'],
          ['Ask', p.ask || 'No ask'],
        ]}
      />
      <Section style={{ padding: '0 0 16px' }}>
        <EmailButton href={p.reviewUrl}>Review pitch</EmailButton>
      </Section>
      <Text style={text.small}>The company sees the pitch only after you approve it.</Text>
    </EmailLayout>
  )
}
