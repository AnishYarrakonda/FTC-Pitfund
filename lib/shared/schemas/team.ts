import { z } from 'zod'

import { MAX_SUMMARY_LENGTH, MAX_TEAM_NAME_LENGTH, REPORT_REASONS } from '../team'
import { normalizeWebsite } from '../url'

/* Shared by the team forms (client) and the team/invite/report actions (server). */

const teamNumberSchema = z.coerce
  .number({ message: 'Enter your FTC team number' })
  .int('Team numbers are whole numbers')
  .positive('Enter your FTC team number')
  .max(999999, 'That team number is too long')

export const lookupTeamSchema = z.object({ number: teamNumberSchema })

const placeText = (label: string) => z.string().trim().max(80, `Keep the ${label} under 80 characters`)

export const createTeamSchema = z.object({
  number: teamNumberSchema,
  name: z.string().trim().min(1, 'Enter your team name').max(MAX_TEAM_NAME_LENGTH, `Keep the team name under ${MAX_TEAM_NAME_LENGTH} characters`),
  city: placeText('city').min(1, 'Enter your team’s city'),
  state: placeText('state or region').min(1, 'Enter your team’s state or region'),
  country: z.string().trim().max(80).optional().nullable(),
  /** How the details were confirmed: from FIRST records, typed after "not found", or typed while records were down. */
  source: z.enum(['matched', 'manual', 'unchecked']),
  adult: z.literal(true, { message: 'Confirm that you’re 18 or older and coach or mentor this team' }),
  terms: z.literal(true, { message: 'Accept the Terms and Privacy Policy to continue' }),
})


const websiteSchema = z
  .string()
  .trim()
  .max(300, 'Keep the website under 300 characters')
  .transform((v, ctx) => {
    if (v === '') return null
    const normalized = normalizeWebsite(v)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Enter a website like exodiusftc.com' })
      return z.NEVER
    }
    return normalized
  })

export const teamProfileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your team name').max(MAX_TEAM_NAME_LENGTH, `Keep the team name under ${MAX_TEAM_NAME_LENGTH} characters`),
  city: placeText('city').min(1, 'Enter your team’s city'),
  state: placeText('state or region').min(1, 'Enter your team’s state or region'),
  summary: z
    .string()
    .trim()
    .max(MAX_SUMMARY_LENGTH, `Keep the summary to ${MAX_SUMMARY_LENGTH} characters`)
    .transform((v) => (v === '' ? null : v.replace(/\s+/g, ' '))),
  website: websiteSchema,
})


export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Enter an email address').email('Enter a valid email address, like name@example.com'),
})

export const reportSchema = z.object({
  teamNumber: teamNumberSchema,
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]], { message: 'Choose a reason' }),
  details: z
    .string()
    .trim()
    .max(2000, 'Keep the details under 2,000 characters')
    .transform((v) => (v === '' ? null : v)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || z.email().safeParse(v).success, 'Enter a valid email address, or leave it empty'),
})

