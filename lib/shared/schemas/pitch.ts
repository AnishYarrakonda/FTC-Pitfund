import { z } from 'zod'

import { MAX_ASK_DOLLARS, MAX_ASK_NOTE } from '../pitch'
import { MAX_ANSWER_LENGTH, MAX_QUESTIONS } from '../questions'

/* Shared by the pitch composer (browser) and the pitch actions (server). */

export const askSchema = z
  .object({
    type: z.enum(['none', 'amount', 'in_kind', 'open']),
    amountDollars: z
      .number()
      .int('Enter a whole-dollar amount')
      .min(1, 'Enter an amount of at least $1')
      .max(MAX_ASK_DOLLARS, 'Enter an amount under $1,000,000')
      .nullable(),
    note: z
      .string()
      .trim()
      .max(MAX_ASK_NOTE, `Keep the note under ${MAX_ASK_NOTE} characters`)
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .transform((ask) => ({
    type: ask.type,
    amountDollars: ask.type === 'amount' ? ask.amountDollars : null,
    note: ask.type === 'in_kind' || ask.type === 'open' ? ask.note : null,
  }))

export const draftContentSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(100),
        answer: z.string().max(MAX_ANSWER_LENGTH, `Keep each answer under ${MAX_ANSWER_LENGTH.toLocaleString()} characters`),
      }),
    )
    .max(MAX_QUESTIONS),
  ask: askSchema,
})

export const saveDraftSchema = draftContentSchema.extend({
  sponsorId: z.uuid(),
  pitchId: z.uuid().nullable(),
})

export type SaveDraftInput = z.input<typeof saveDraftSchema>

export const submitPitchSchema = draftContentSchema.extend({ pitchId: z.uuid() })

export const pitchIdSchema = z.object({ pitchId: z.uuid() })
export const sponsorIdSchema = z.object({ sponsorId: z.uuid() })
