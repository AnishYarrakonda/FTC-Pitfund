import 'server-only'

import { render, toPlainText } from 'react-email'
import { createElement, type ComponentType } from 'react'

import LoginCodeEmail, { loginCodeSchema, loginCodeSubject } from './login-code'
import NoticeEmail, { noticeSchema } from './notice'

/*
 * Template registry. The outbox stores `template` + `payload`; rendering happens at send
 * time so a queued email always uses the current template. Add a template: create the
 * component + zod schema, then register it here.
 */

const registry = {
  'login-code': {
    schema: loginCodeSchema,
    subject: loginCodeSubject,
    component: LoginCodeEmail,
    // The code is scrubbed from the outbox row once the email is sent or has failed.
    sensitive: true,
  },
  notice: {
    schema: noticeSchema,
    subject: (p: { subject: string }) => p.subject,
    component: NoticeEmail,
    sensitive: false,
  },
} as const

export type TemplateName = keyof typeof registry
export type TemplatePayload<T extends TemplateName> = Parameters<(typeof registry)[T]['component']>[0]

export function isTemplateName(name: string): name is TemplateName {
  return name in registry
}

export function isSensitiveTemplate(name: string) {
  return isTemplateName(name) && registry[name].sensitive
}

export class TemplateError extends Error {}

export async function renderEmail(template: string, payload: unknown) {
  if (!isTemplateName(template)) throw new TemplateError(`Unknown email template "${template}"`)
  const entry = registry[template]
  const parsed = entry.schema.safeParse(payload)
  if (!parsed.success) throw new TemplateError(`Invalid payload for "${template}": ${parsed.error.message}`)
  const component = entry.component as ComponentType<Record<string, unknown>>
  const element = createElement(component, parsed.data as Record<string, unknown>)
  const html = await render(element)
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subject: (entry.subject as (p: any) => string)(parsed.data),
    html,
    text: toPlainText(html),
  }
}
