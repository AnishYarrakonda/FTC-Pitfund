import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

export const sponsorApprovedSchema = z.object({
  companyName: z.string().min(1).max(200),
  companyUrl: z.string().url(),
})

export type SponsorApprovedProps = z.input<typeof sponsorApprovedSchema>

export function sponsorApprovedSubject(props: SponsorApprovedProps) {
  return `${props.companyName} is approved on FTC Pitfund`
}

export default function SponsorApprovedEmail(props: SponsorApprovedProps) {
  const p = sponsorApprovedSchema.parse(props)
  return (
    <EmailLayout preview={`You’re approved. Teams can now pitch ${p.companyName}.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>You’re approved. Teams can now pitch {p.companyName}.</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>
        {p.companyName} now appears in the FTC Pitfund directory. Every pitch is read by a reviewer before it reaches you, and we’ll email you when one arrives.
      </Text>
      <Text style={text.body}>You can also invite coworkers now, so a pitch never waits on one person.</Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.companyUrl}>Open your company</EmailButton>
      </Section>
    </EmailLayout>
  )
}
