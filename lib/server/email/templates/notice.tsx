import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailButton, EmailLayout, text } from './layout'

/**
 * A plain notification: a title, a few short paragraphs and one link into the app.
 * The generic fallback; feature emails in prompts 2–3 get their own templates.
 */
export const noticeSchema = z.object({
  subject: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  paragraphs: z.array(z.string().max(2000)).max(6).default([]),
  cta: z.object({ label: z.string().min(1).max(40), href: z.string().url() }).optional(),
})

export type NoticeProps = z.input<typeof noticeSchema>

export default function NoticeEmail(props: NoticeProps) {
  const { title, paragraphs, cta } = noticeSchema.parse(props)
  return (
    <EmailLayout preview={paragraphs[0] ?? title}>
      <Text style={text.h1}>{title}</Text>
      {paragraphs.map((p, i) => (
        <Text key={i} style={{ ...text.body, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {p}
        </Text>
      ))}
      {cta ? (
        <Section style={{ paddingTop: '4px' }}>
          <EmailButton href={cta.href}>{cta.label}</EmailButton>
        </Section>
      ) : null}
    </EmailLayout>
  )
}
