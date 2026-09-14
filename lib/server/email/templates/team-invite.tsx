import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const teamInviteSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  inviterName: z.string().max(200),
  email: z.string().email(),
  acceptUrl: z.string().url(),
  expiresOn: z.string().min(1).max(40),
})

export type TeamInviteProps = z.input<typeof teamInviteSchema>

export function teamInviteSubject(props: TeamInviteProps) {
  return `Join Team ${props.teamNumber} · ${props.teamName} on FTC Pitfund`
}

export default function TeamInviteEmail(props: TeamInviteProps) {
  const p = teamInviteSchema.parse(props)
  const who = p.inviterName.trim() || 'A coach'
  return (
    <EmailLayout preview={`${who} invited you to join Team ${p.teamNumber} on FTC Pitfund.`}>
      <Text style={text.h1}>
        Join Team {p.teamNumber} · {p.teamName}
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        {who} invited you to the team&apos;s shared FTC Pitfund account, where coaches upload the sponsorship deck and pitch
        companies that sponsor robotics teams.
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        Sign in with <strong>{p.email}</strong> to accept. The invite works once and expires on {p.expiresOn}.
      </Text>
      <Section style={{ padding: '4px 0 16px' }}>
        <EmailButton href={p.acceptUrl}>Join the team</EmailButton>
      </Section>
      <Text style={{ ...text.small }}>FTC Pitfund accounts are for adult coaches and mentors. If you weren&apos;t expecting this, ignore it.</Text>
    </EmailLayout>
  )
}
