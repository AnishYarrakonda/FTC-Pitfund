import type { Question } from './questions'
import type { OrgStatus } from './types'

/* Company (sponsor) rules and copy shared by the server and the browser (prompt 3). */

export const MAX_COMPANY_NAME_LENGTH = 60
export const MAX_ABOUT_LENGTH = 1000
export const MAX_REGION_LENGTH = 120
export const MAX_JOB_TITLE_LENGTH = 120

/** "Not a fit" reasons (plan §3.2 "Sponsor response"). `other` takes free text. */
export const DECLINE_REASONS = [
  { value: 'focus', label: 'Not aligned with our focus' },
  { value: 'region', label: 'Outside our region' },
  { value: 'budget', label: 'Budget already allocated' },
  { value: 'other', label: 'Other' },
] as const

export type DeclineReasonKey = (typeof DECLINE_REASONS)[number]['value']

export const MAX_DECLINE_NOTE = 500

/** The text stored in pitches.decline_reason (null when no reason was given). */
export function declineReasonText(reason: DeclineReasonKey | null, note: string | null): string | null {
  if (!reason) return null
  if (reason === 'other') return note?.trim() ? note.trim() : null
  return DECLINE_REASONS.find((r) => r.value === reason)!.label
}

type CompanySetupItem = { key: 'logo' | 'about' | 'supportTypes' | 'questions'; label: string; done: boolean; href: string }

/** The profile checklist on /inbox and /company while a company sets itself up. */
export function companyChecklist(company: { hasLogo: boolean; hasAbout: boolean; supportTypeCount: number; questionCount: number; reviewedQuestions: boolean }) {
  const items: CompanySetupItem[] = [
    { key: 'logo', label: 'Add your logo', done: company.hasLogo, href: '/company#profile' },
    { key: 'about', label: 'Describe what you look for', done: company.hasAbout, href: '/company#profile' },
    { key: 'supportTypes', label: 'Choose the kinds of support you offer', done: company.supportTypeCount > 0, href: '/company#profile' },
    { key: 'questions', label: 'Review the questions teams answer', done: company.questionCount > 0 || company.reviewedQuestions, href: '/company#questions' },
  ]
  return { items, done: items.filter((i) => i.done).length, total: items.length, complete: items.every((i) => i.done) }
}

/** A validated LinkedIn profile or company URL, or null. */
export function normalizeLinkedin(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null
  if (!/^\/(in|company|pub|school)\/[^/]+/i.test(url.pathname)) return null
  const href = `https://www.linkedin.com${url.pathname.replace(/\/$/, '')}`
  return href.length <= 300 ? href : null
}

export function companyStatusCopy(status: OrgStatus, name: string) {
  switch (status) {
    case 'pending':
      return `Your company is under review. Teams can’t see ${name} until it’s approved, usually within 1–2 days. We’ll email you. Meanwhile, set up your profile and questions.`
    case 'rejected':
      return `Teams can’t see or pitch ${name}.`
    case 'suspended':
      return `Teams can’t see or pitch ${name} while it’s suspended.`
    default:
      return null
  }
}

/** A new question in the editor (ids are stable so answers stay attached to their question). */
export function newQuestion(): Question {
  return { id: `q-${Math.random().toString(36).slice(2, 10)}`, prompt: '', help: '', required: true }
}
