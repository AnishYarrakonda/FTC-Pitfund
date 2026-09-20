import { Section, Text } from 'react-email'
import { z } from 'zod'

import { SUPPORT_EMAIL } from '@/lib/shared/brand'

import { EmailButton, EmailLayout, text } from './layout'

export const sponsorRejectedSchema = z.object({
  companyName: z.string().min(1).max(200),
  note: z.string().min(1).max(5000),
  inboxUrl: z.string().url(),
})

export type SponsorRejectedProps = z.input<typeof sponsorRejectedSchema>

export function sponsorRejectedSubject(props: SponsorRejectedProps) {
  return `${props.companyName} wasn’t approved on FTC Pitfund`
}

export default function SponsorRejectedEmail(props: SponsorRejectedProps) {
  const p = sponsorRejectedSchema.parse(props)
  return (
    <EmailLayout preview={`We couldn’t approve ${p.companyName}. Here is why.`}>
      <Text style={{ ...text.h1, wordBreak: 'break-word' }}>{p.companyName} wasn’t approved</Text>
      <Text style={text.body}>An FTC Pitfund admin reviewed your company and couldn’t approve it. Their note:</Text>
      <Text style={{ ...text.body, color: '#061B31', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderLeft: '3px solid #E7E7EA', paddingLeft: '12px' }}>{p.note}</Text>
      <Text style={{ ...text.body, wordBreak: 'break-word' }}>If you think this is a mistake, or you can share more about your company, reply to this email or write to {SUPPORT_EMAIL}.</Text>
      <Section style={{ padding: '4px 0 0' }}>
        <EmailButton href={p.inboxUrl}>Open FTC Pitfund</EmailButton>
      </Section>
    </EmailLayout>
  )
}
