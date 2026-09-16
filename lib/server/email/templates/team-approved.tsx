import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const teamApprovedSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  pitchesUrl: z.string().url(),
})

export type TeamApprovedProps = z.input<typeof teamApprovedSchema>

export function teamApprovedSubject(props: TeamApprovedProps) {
  return `Team ${props.teamNumber} is approved on FTC Pitfund`
}

export default function TeamApprovedEmail(props: TeamApprovedProps) {
  const p = teamApprovedSchema.parse(props)
  return (
    <EmailLayout preview={`You’re approved. Team ${p.teamNumber} can start pitching companies.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>You’re approved. Team {p.teamNumber} can start pitching.</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        We checked {p.teamName} against FIRST records and the proof you sent. Your team page is live, and you can now pitch any company in the
        directory.
      </Text>
      <Text style={text.body}>Every pitch is read by a reviewer before the company sees it, so take your time with the first one.</Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.pitchesUrl}>Start a pitch</EmailButton>
      </Section>
    </EmailLayout>
  )
}
