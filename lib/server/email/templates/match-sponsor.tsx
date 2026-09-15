import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailFacts, EmailLayout, text } from './layout'

/** To the company member who clicked Interested: the team's contact details. */
export const matchSponsorSchema = z.object({
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).nullable(),
  teamUrl: z.string().url(),
  pitchUrl: z.string().url(),
})

export type MatchSponsorProps = z.input<typeof matchSponsorSchema>

export function matchSponsorSubject(props: MatchSponsorProps) {
  return `You’re connected with Team ${props.teamNumber} · ${props.teamName}`
}

export default function MatchSponsorEmail(props: MatchSponsorProps) {
  const p = matchSponsorSchema.parse(props)
  return (
    <EmailLayout preview={`Here is how to reach ${p.contactName} from Team ${p.teamNumber}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>
        You’re connected with Team {p.teamNumber} · {p.teamName}
      </Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        We shared your name, title and email with the team. Here is their coach’s contact, so you can take it from here.
      </Text>
      <EmailFacts
        rows={[
          ['Coach', p.contactName],
          ['Email', p.contactEmail],
          ...(p.contactPhone ? [['Phone', p.contactPhone] as [string, string]] : []),
          ['Team page', p.teamUrl],
        ]}
      />
      <Section style={{ padding: '0 0 4px' }}>
        <EmailButton href={p.pitchUrl}>Open the pitch</EmailButton>
      </Section>
    </EmailLayout>
  )
}
