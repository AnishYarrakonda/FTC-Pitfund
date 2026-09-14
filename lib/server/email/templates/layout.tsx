import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from 'react-email'
import type { CSSProperties, ReactNode } from 'react'

import { FIRST_DISCLAIMER, PRODUCT_NAME, SUPPORT_EMAIL } from '@/lib/shared/brand'

/*
 * Base layout for every FTC Pitfund email: wordmark, one white panel, a plain footer.
 * Colors are the plan §7 tokens, inlined because email clients ignore stylesheets.
 */

export const emailColors = {
  canvas: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E7E7EA',
  text: '#0B0B0C',
  textSecondary: '#52525B',
  textTertiary: '#71717A',
  accent: '#1F6F5C',
  accentSubtle: '#EAF3F0',
}

export const fontStack =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const body: CSSProperties = {
  backgroundColor: emailColors.canvas,
  margin: 0,
  padding: '40px 16px',
  fontFamily: fontStack,
  color: emailColors.text,
}

const container: CSSProperties = { maxWidth: '520px', margin: '0 auto' }

const panel: CSSProperties = {
  backgroundColor: emailColors.surface,
  border: `1px solid ${emailColors.border}`,
  borderRadius: '12px',
  padding: '36px 32px',
}

export const text = {
  h1: { fontSize: '20px', lineHeight: '28px', fontWeight: 600, margin: '0 0 12px', color: emailColors.text },
  body: { fontSize: '14px', lineHeight: '22px', margin: '0 0 16px', color: emailColors.textSecondary },
  small: { fontSize: '13px', lineHeight: '20px', margin: 0, color: emailColors.textTertiary },
} satisfies Record<string, CSSProperties>

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={{ padding: '0 4px 20px' }}>
            <Text style={{ margin: 0, fontSize: '15px', lineHeight: '24px', fontWeight: 600, letterSpacing: '-0.01em' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '3px',
                  backgroundColor: emailColors.accent,
                  marginRight: '8px',
                  verticalAlign: '0px',
                }}
              />
              {PRODUCT_NAME}
            </Text>
          </Section>
          <Section style={panel}>{children}</Section>
          <Section style={{ padding: '20px 4px 0' }}>
            <Text style={text.small}>
              Questions? Write to{' '}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={{ color: emailColors.textSecondary, textDecoration: 'underline' }}>
                {SUPPORT_EMAIL}
              </Link>
              .
            </Text>
            <Hr style={{ borderColor: emailColors.border, margin: '16px 0' }} />
            <Text style={text.small}>{FIRST_DISCLAIMER}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor: emailColors.accent,
        color: '#FFFFFF',
        fontSize: '14px',
        lineHeight: '20px',
        fontWeight: 500,
        textDecoration: 'none',
        padding: '10px 18px',
        borderRadius: '6px',
      }}
    >
      {children}
    </Link>
  )
}
