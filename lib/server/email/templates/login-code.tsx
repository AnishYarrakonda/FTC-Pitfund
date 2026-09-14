import { Section, Text } from 'react-email'
import { z } from 'zod'

import { EmailLayout, emailColors, text } from './layout'

export const loginCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  expiresInMinutes: z.number().int().positive().default(10),
})

export type LoginCodeProps = z.input<typeof loginCodeSchema>

export function loginCodeSubject(props: LoginCodeProps) {
  return `${props.code} is your FTC Pitfund sign-in code`
}

export default function LoginCodeEmail(props: LoginCodeProps) {
  const { code, expiresInMinutes } = loginCodeSchema.parse(props)
  return (
    <EmailLayout preview={`Your sign-in code is ${code}. It expires in ${expiresInMinutes} minutes.`}>
      <Text style={text.h1}>Your sign-in code</Text>
      <Text style={text.body}>Enter this code on the FTC Pitfund sign-in page.</Text>
      <Section
        style={{
          backgroundColor: emailColors.canvas,
          border: `1px solid ${emailColors.border}`,
          borderRadius: '8px',
          padding: '18px 0',
          margin: '8px 0 20px',
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: '30px',
            lineHeight: '38px',
            fontWeight: 600,
            letterSpacing: '0.24em',
            fontVariantNumeric: 'tabular-nums',
            color: emailColors.text,
            fontFamily: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
          }}
        >
          {code}
        </Text>
      </Section>
      <Text style={{ ...text.body, marginBottom: 0 }}>
        It expires in {expiresInMinutes} minutes. If you didn&apos;t try to sign in, you can ignore this email.
      </Text>
    </EmailLayout>
  )
}
