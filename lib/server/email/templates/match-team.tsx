import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailFacts, EmailLayout, text } from './layout'

/** To the coach who submitted: the company is interested, here is who to contact. */
export const matchTeamSchema = z.object({
  teamNumber: z.number().int().positive(),
  companyName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  contactTitle: z.string().max(5000).nullable(),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).nullable(),
  companyWebsite: z.string().url().nullable(),
  pitchUrl: z.string().url(),
})

export type MatchTeamProps = z.input<typeof matchTeamSchema>

export function matchTeamSubject(props: MatchTeamProps) {
  return `${props.companyName} is interested in Team ${props.teamNumber}`
}

export default function MatchTeamEmail(props: MatchTeamProps) {
  const p = matchTeamSchema.parse(props)
  const rows: Array<[string, string]> = [
    ['Name', p.contactName],
    ...(p.contactTitle ? [['Title', p.contactTitle] as [string, string]] : []),
    ['Email', p.contactEmail],
    ...(p.contactPhone ? [['Phone', p.contactPhone] as [string, string]] : []),
    ...(p.companyWebsite ? [['Website', p.companyWebsite] as [string, string]] : []),
  ]
  return (
    <EmailLayout preview={`${p.companyName} wants to talk. Here is how to reach ${p.contactName}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>{p.companyName} is interested</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        {p.companyName} read your pitch and wants to talk. We shared your name and email with them. Reach out to {p.contactName} and take it from here.
      </Text>
      <EmailFacts rows={rows} />
      <Section style={{ padding: '0 0 4px' }}>
        <EmailButton href={p.pitchUrl}>Open the pitch</EmailButton>
      </Section>
    </EmailLayout>
  )
}
