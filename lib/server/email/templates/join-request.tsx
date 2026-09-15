import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const joinRequestSchema = z.object({
  requesterName: z.string().max(200),
  requesterEmail: z.string().email(),
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  reviewUrl: z.string().url(),
})

export type JoinRequestProps = z.input<typeof joinRequestSchema>

export function joinRequestSubject(props: JoinRequestProps) {
  return `${props.requesterName.trim() || props.requesterEmail} wants to join Team ${props.teamNumber}`
}

export default function JoinRequestEmail(props: JoinRequestProps) {
  const p = joinRequestSchema.parse(props)
  const who = p.requesterName.trim() || p.requesterEmail
  return (
    <EmailLayout preview={`${who} asked to join Team ${p.teamNumber} · ${p.teamName}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>{who} wants to join your team</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        {who} ({p.requesterEmail}) asked to join Team {p.teamNumber} · {p.teamName} on FTC Pitfund. Once approved, they can edit the
        team profile and pitch companies like every other member.
      </Text>
      <Section style={{ padding: '4px 0 16px' }}>
        <EmailButton href={p.reviewUrl}>Review the request</EmailButton>
      </Section>
      <Text style={text.small}>Don&apos;t recognize them? Decline the request. They won&apos;t see your team&apos;s pitches.</Text>
    </EmailLayout>
  )
}
