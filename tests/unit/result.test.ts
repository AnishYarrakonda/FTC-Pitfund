import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { getDb } from '@/lib/server/db'
import { AppError, defineAction, mapDbError, toActionError } from '@/lib/server/result'
import { teams } from '@/lib/server/schema'

import { createTeam, dbTest } from './helpers/db'

describe('defineAction', () => {
  const action = defineAction(
    z.object({ name: z.string().trim().min(1, 'Enter a name'), count: z.number().int().max(3, 'At most 3') }),
    async ({ name, count }) => {
      if (name === 'boom') throw new Error('database exploded')
      if (name === 'gone') throw new AppError('NOT_FOUND', "That pitch doesn't exist.")
      return { greeting: `hi ${name}`, count }
    },
  )

  it('validates with zod and returns field errors', async () => {
    const result = await action({ name: ' ', count: 9 })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'Enter a name',
        field: 'name',
        fieldErrors: { name: 'Enter a name', count: 'At most 3' },
      },
    })
  })

  it('returns data on success', async () => {
    expect(await action({ name: 'Maya', count: 1 })).toEqual({ ok: true, data: { greeting: 'hi Maya', count: 1 } })
  })

  it('passes AppError codes through and hides unexpected errors behind a reference', async () => {
    expect(await action({ name: 'gone', count: 1 })).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: "That pitch doesn't exist." } })
    const unexpected = await action({ name: 'boom', count: 1 })
    expect(unexpected.ok).toBe(false)
    if (!unexpected.ok) {
      expect(unexpected.error.code).toBe('UNKNOWN')
      expect(unexpected.error.reference).toMatch(/^[a-z0-9]{8,}$/)
      expect(unexpected.error.message).toContain(unexpected.error.reference)
      expect(unexpected.error.message).not.toContain('database exploded')
    }
  })
})

describe('mapDbError', () => {
  it(
    'maps a real unique violation to CONFLICT with the caller message (per constraint)',
    dbTest(async () => {
      const team = await createTeam()
      let caught: unknown
      try {
        await getDb().execute(sql`savepoint dup`)
        await getDb().insert(teams).values({ number: team.number, name: 'Duplicate' })
      } catch (e) {
        caught = e
        await getDb().execute(sql`rollback to savepoint dup`)
      }
      expect(mapDbError(caught, { conflict: 'Team already exists.' })).toEqual({ code: 'CONFLICT', message: 'Team already exists.' })
      expect(mapDbError(caught, { conflict: { teams_number_key: 'Team 1 is already on FTC Pitfund.' } })).toEqual({
        code: 'CONFLICT',
        message: 'Team 1 is already on FTC Pitfund.',
      })
    }),
  )

  it('maps check violations and ignores non-database errors', () => {
    expect(mapDbError({ code: '23514' })?.code).toBe('VALIDATION')
    expect(mapDbError({ code: '23503' })?.code).toBe('NOT_FOUND')
    expect(mapDbError({ cause: { cause: { code: '23505', constraint_name: 'x' } } })?.code).toBe('CONFLICT')
    expect(mapDbError(new Error('nope'))).toBeNull()
    expect(toActionError(new AppError('RATE_LIMITED', 'Slow down'))).toEqual({ code: 'RATE_LIMITED', message: 'Slow down' })
  })
})
