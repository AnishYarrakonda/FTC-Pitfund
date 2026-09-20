import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const pitchNotAFitSchema = z.object({
  teamNumber: z.number().int().positive(),
  companyName: z.string().min(1).max(200),
  reason: z.string().max(5000).nullable(),
  pitchUrl: z.string().url(),
})

export type PitchNotAFitProps = z.input<typeof pitchNotAFitSchema>

export function pitchNotAFitSubject(props: PitchNotAFitProps) {
  return `${props.companyName} isn’t a fit this time`
}

export default function PitchNotAFitEmail(props: PitchNotAFitProps) {
  const p = pitchNotAFitSchema.parse(props)
  return (
    <EmailLayout preview={`${p.companyName} read your pitch and decided it isn’t a fit this time.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>{p.companyName} isn’t a fit this time</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        {p.companyName} read Team {p.teamNumber}’s pitch and decided not to go ahead this season.
        {p.reason ? ' They said:' : ' They didn’t give a reason.'}
      </Text>
      {p.reason ? <Text style={{ ...text.body, color: '#061B31', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>“{p.reason}”</Text> : null}
      <Text style={{ ...text.body }}>It happens to every team. Keep pitching the companies that match what you do.</Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.pitchUrl}>Open the pitch</EmailButton>
      </Section>
    </EmailLayout>
  )
}
