import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const sponsorInviteSchema = z.object({
  companyName: z.string().min(1).max(200),
  inviterName: z.string().max(200),
  email: z.string().email(),
  acceptUrl: z.string().url(),
  expiresOn: z.string().min(1).max(40),
})

export type SponsorInviteProps = z.input<typeof sponsorInviteSchema>

export function sponsorInviteSubject(props: SponsorInviteProps) {
  return `Join ${props.companyName} on FTC Pitfund`
}

export default function SponsorInviteEmail(props: SponsorInviteProps) {
  const p = sponsorInviteSchema.parse(props)
  const who = p.inviterName.trim() || 'A coworker'
  return (
    <EmailLayout preview={`${who} invited you to ${p.companyName}’s FTC Pitfund account.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>Join {p.companyName} on FTC Pitfund</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        {who} invited you to {p.companyName}’s shared account, where your company reads screened sponsorship pitches from FTC robotics teams and chooses who to connect with.
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        Sign in with <strong>{p.email}</strong> to accept. The invite works once and expires on {p.expiresOn}.
      </Text>
      <Section style={{ padding: '4px 0 16px' }}>
        <EmailButton href={p.acceptUrl}>Join {p.companyName.length > 40 ? 'the company' : p.companyName}</EmailButton>
      </Section>
      <Text style={text.small}>If you weren’t expecting this, ignore it.</Text>
    </EmailLayout>
  )
}
