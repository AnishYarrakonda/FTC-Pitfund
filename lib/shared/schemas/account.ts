import { z } from 'zod'

/* Shared by the account form (client) and the server action. */

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null)

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120, 'Keep your name under 120 characters'),
  phone: optionalText(40, 'Keep the phone number under 40 characters').refine(
    (v) => v === null || /^[0-9+().\-\s x]{7,40}$/i.test(v),
    'Enter a phone number with digits, spaces, dashes or parentheses',
  ),
  jobTitle: optionalText(120, 'Keep the job title under 120 characters'),
})


export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Enter your email address').email('Enter a valid email address, like name@example.com'),
})

export const codeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
  next: z.string().optional(),
  intent: z.enum(['team', 'company']).optional(),
})

export const welcomeSchema = z.object({
  role: z.enum(['team', 'sponsor'], { message: 'Choose how you’ll use FTC Pitfund' }),
  name: z.string().trim().min(1, 'Enter your name').max(120, 'Keep your name under 120 characters'),
  adult: z.literal(true, { message: 'Confirm that you’re 18 or older' }),
  terms: z.literal(true, { message: 'Accept the Terms and Privacy Policy to continue' }),
})

/** What a visitor chose on the landing page ("I coach a team" / "I represent a company"). */
export type SignInIntent = 'team' | 'company'

export function parseIntent(value: unknown): SignInIntent | null {
  return value === 'team' || value === 'company' ? value : null
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  if (next.startsWith('/login') || next.startsWith('/auth/') || next.startsWith('/api/')) return null
  return next
}
