import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailFacts, EmailLayout, text } from './layout'

/** To every member of the company when an admin approves a pitch to it. */
export const newPitchSponsorSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  place: z.string().max(200).nullable(),
  verified: z.boolean(),
  companyName: z.string().min(1).max(200),
  summary: z.string().max(400).nullable(),
  ask: z.string().max(700).nullable(),
  inboxUrl: z.string().url(),
})

export type NewPitchSponsorProps = z.input<typeof newPitchSponsorSchema>

export function newPitchSponsorSubject(props: NewPitchSponsorProps) {
  return `New pitch from Team ${props.teamNumber} · ${props.teamName}`
}

export default function NewPitchSponsorEmail(props: NewPitchSponsorProps) {
  const p = newPitchSponsorSchema.parse(props)
  return (
    <EmailLayout preview={`Team ${p.teamNumber} answered ${p.companyName}’s questions. A reviewer already checked it.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>
        New pitch from Team {p.teamNumber} · {p.teamName}
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        The team answered {p.companyName}’s questions and attached its sponsorship deck. An FTC Pitfund reviewer read it before sending it to you.
      </Text>
      <EmailFacts
        rows={[
          ['Team', `Team ${p.teamNumber} · ${p.teamName}${p.place ? `, ${p.place}` : ''}${p.verified ? ' (verified)' : ''}`],
          ['One-line summary', p.summary || 'No summary'],
          ['Ask', p.ask || 'No specific ask'],
        ]}
      />
      <Section style={{ padding: '0 0 16px' }}>
        <EmailButton href={p.inboxUrl}>Read the pitch</EmailButton>
      </Section>
      <Text style={text.small}>Say you’re interested and you’ll both get each other’s contact details. Everyone at {p.companyName} on FTC Pitfund got this email.</Text>
    </EmailLayout>
  )
}
