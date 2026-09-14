import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const joinDecisionSchema = z.object({
  approved: z.boolean(),
  teamNumber: z.number().int().positive(),
  teamName: z.string().min(1).max(200),
  url: z.string().url(),
})

export type JoinDecisionProps = z.input<typeof joinDecisionSchema>

export function joinDecisionSubject(props: JoinDecisionProps) {
  return props.approved
    ? `You're on Team ${props.teamNumber} · ${props.teamName}`
    : `Your request to join Team ${props.teamNumber} wasn't approved`
}

export default function JoinDecisionEmail(props: JoinDecisionProps) {
  const p = joinDecisionSchema.parse(props)
  const team = `Team ${p.teamNumber} · ${p.teamName}`
  return (
    <EmailLayout preview={p.approved ? `A coach approved your request to join ${team}.` : `A coach declined your request to join ${team}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>{p.approved ? `You're on ${team}` : 'Your request wasn’t approved'}</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        {p.approved
          ? 'A coach approved your request. You now share the team’s FTC Pitfund account: its profile, deck and pitches.'
          : `A coach on ${team} declined your request to join. If you think that’s a mistake, ask them directly, or check that you looked up the right team number.`}
      </Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.url}>{p.approved ? 'Open your team' : 'Look up your team'}</EmailButton>
      </Section>
    </EmailLayout>
  )
}
