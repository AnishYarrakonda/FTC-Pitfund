import { z } from 'zod'

import { DECLINE_REASONS, MAX_ABOUT_LENGTH, MAX_COMPANY_NAME_LENGTH, MAX_DECLINE_NOTE, MAX_JOB_TITLE_LENGTH, MAX_REGION_LENGTH, normalizeLinkedin } from '../company'
import { MAX_QUESTION_HELP, MAX_QUESTION_PROMPT, MAX_QUESTIONS } from '../questions'
import { SUPPORT_TYPES } from '../types'
import { normalizeWebsite } from '../url'

/* Shared by the company forms (browser) and the company, inbox and admin actions (server). */

const requiredWebsite = z
  .string()
  .trim()
  .min(1, 'Enter your company’s website')
  .max(300, 'Keep the website under 300 characters')
  .transform((v, ctx) => {
    const normalized = normalizeWebsite(v)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Enter a website like example.com' })
      return z.NEVER
    }
    return normalized
  })

const companyName = z
  .string()
  .trim()
  .min(1, 'Enter your company’s name')
  .max(MAX_COMPANY_NAME_LENGTH, `Keep the company name under ${MAX_COMPANY_NAME_LENGTH} characters`)

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === '' ? null : v))

export const createCompanySchema = z.object({
  name: companyName,
  website: requiredWebsite,
  yourName: z.string().trim().min(1, 'Enter your name').max(120, 'Keep your name under 120 characters'),
  jobTitle: z.string().trim().min(1, 'Enter your job title').max(MAX_JOB_TITLE_LENGTH, `Keep the job title under ${MAX_JOB_TITLE_LENGTH} characters`),
  linkedin: z
    .string()
    .trim()
    .max(300, 'Keep the LinkedIn link under 300 characters')
    .transform((v, ctx) => {
      if (v === '') return null
      const normalized = normalizeLinkedin(v)
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Enter a LinkedIn link like linkedin.com/in/your-name' })
        return z.NEVER
      }
      return normalized
    }),
  adult: z.literal(true, { message: 'Confirm that you’re 18 or older' }),
  terms: z.literal(true, { message: 'Accept the Terms and Privacy Policy to continue' }),
})


export const companyProfileSchema = z.object({
  name: companyName,
  website: requiredWebsite,
  city: optionalText(80, 'Keep the city under 80 characters'),
  state: optionalText(80, 'Keep the state under 80 characters'),
  region: optionalText(MAX_REGION_LENGTH, `Keep this under ${MAX_REGION_LENGTH} characters`),
  about: optionalText(MAX_ABOUT_LENGTH, `Keep this under ${MAX_ABOUT_LENGTH.toLocaleString()} characters`),
  supportTypes: z.array(z.enum(SUPPORT_TYPES)).max(SUPPORT_TYPES.length).transform((v) => [...new Set(v)]),
})


const questionSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Invalid question id'),
  prompt: z.string().trim().min(1, 'Write the question').max(MAX_QUESTION_PROMPT, `Keep the question under ${MAX_QUESTION_PROMPT} characters`),
  help: z
    .string()
    .trim()
    .max(MAX_QUESTION_HELP, `Keep the helper text under ${MAX_QUESTION_HELP} characters`)
    .optional()
    .transform((v) => (v ? v : undefined)),
  required: z.boolean(),
})

export const questionsSchema = z.object({
  questions: z
    .array(questionSchema)
    .max(MAX_QUESTIONS, `A company can ask up to ${MAX_QUESTIONS} questions`)
    .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, 'Each question needs its own id'),
})

export const declineSchema = z
  .object({
    pitchId: z.uuid(),
    reason: z.enum(DECLINE_REASONS.map((r) => r.value) as [string, ...string[]]).nullable(),
    note: z.string().trim().max(MAX_DECLINE_NOTE, `Keep the reason under ${MAX_DECLINE_NOTE} characters`).nullable(),
  })
  .refine((v) => v.reason !== 'other' || Boolean(v.note?.trim()), { message: 'Say briefly why, or pick another reason', path: ['note'] })

export const reviewNoteSchema = z.object({
  pitchId: z.uuid(),
  note: z.string().trim().min(1, 'Write a note for the team').max(2000, 'Keep the note under 2,000 characters'),
})

export const rejectPitchSchema = z.object({
  pitchId: z.uuid(),
  note: z
    .string()
    .trim()
    .max(2000, 'Keep the note under 2,000 characters')
    .transform((v) => (v === '' ? null : v)),
})

export const sponsorDecisionSchema = z.object({
  sponsorId: z.uuid(),
  note: z.string().trim().min(1, 'Write a note the company will see').max(2000, 'Keep the note under 2,000 characters'),
})
