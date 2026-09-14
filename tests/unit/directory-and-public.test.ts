import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { DIRECTORY_PAGE_SIZE, queryDirectory, queryDirectorySponsor } from '@/lib/server/data/directory'
import { queryPublicTeam } from '@/lib/server/data/public-team'
import { createReport } from '@/lib/server/data/reports'
import { getDb } from '@/lib/server/db'
import { notifications, reports } from '@/lib/server/schema'
import { loadViewer } from '@/lib/server/viewer'

import { addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'
import { expectAppError } from './helpers/errors'

const query = (q: string, extra: Partial<Parameters<typeof queryDirectory>[0]> = {}) => queryDirectory({ q, type: null, after: null, before: null, ...extra })

describe('sponsor directory', () => {
  it(
    'lists only approved companies, and a non-approved profile is not found',
    dbTest(async () => {
      const tag = `Vis${crypto.randomUUID().slice(0, 8)}`
      const approved = await createSponsor({ name: `${tag} Approved`, status: 'approved' })
      const hidden = await Promise.all((['pending', 'rejected', 'suspended'] as const).map((status) => createSponsor({ name: `${tag} ${status}`, status })))
      const page = await query(tag.toLowerCase())
      expect(page.items.map((i) => i.id)).toEqual([approved.id])
      expect(page).toMatchObject({ nextCursor: null, prevCursor: null })
      expect(await queryDirectorySponsor(approved.id)).toMatchObject({ id: approved.id, usesDefaultQuestions: true })
      expect((await queryDirectorySponsor(approved.id))!.questions).toHaveLength(3)
      for (const s of hidden) expect(await queryDirectorySponsor(s.id)).toBeNull()
    }),
  )

  it(
    'searches by name (LIKE characters are literal), filters by support type and pages by cursor',
    dbTest(async () => {
      const tag = `Pg${crypto.randomUUID().slice(0, 8)}`
      const created = []
      for (let i = 0; i < DIRECTORY_PAGE_SIZE + 3; i++) {
        created.push(await createSponsor({ name: `${tag} ${String(i).padStart(2, '0')}`, supportTypes: i % 2 ? ['equipment'] : ['funding'] }))
      }
      const first = await query(tag)
      expect(first.items).toHaveLength(DIRECTORY_PAGE_SIZE)
      expect(first.prevCursor).toBeNull()
      expect(first.nextCursor).not.toBeNull()
      const second = await query(tag, { after: first.nextCursor })
      expect(second.items.map((i) => i.name)).toEqual([`${tag} 25`, `${tag} 26`, `${tag} 27`])
      expect(second.nextCursor).toBeNull()
      const back = await query(tag, { before: second.prevCursor })
      expect(back.items.map((i) => i.id)).toEqual(first.items.map((i) => i.id))
      expect(back.prevCursor).toBeNull()

      const equipment = await query(tag, { type: 'equipment' })
      expect(equipment.items).toHaveLength(14)
      expect(equipment.items.every((i) => i.supportTypes.includes('equipment'))).toBe(true)
      expect((await query(`${tag}%`)).items).toEqual([])
      expect((await query(tag, { after: 'not-a-cursor' })).items).toHaveLength(DIRECTORY_PAGE_SIZE)
    }),
  )
})

describe('public team page', () => {
  it(
    'returns public fields only, and nothing for suspended or missing teams',
    dbTest(async () => {
      const team = await createTeam({ summary: 'We build robots.', website: 'https://example.org', verifiedAt: new Date(), pdfPath: 't/deck.pdf', pdfPages: 2, pdfBytes: 10, pdfUpdatedAt: new Date() })
      const coach = await createUser({ name: 'Private Coach Name', phone: '(512) 555-0100', email: `private-${crypto.randomUUID()}@pitfund.test` })
      await addTeamMember(team.id, coach.id)

      const page = await queryPublicTeam(team.number)
      expect(Object.keys(page!).sort()).toEqual(['city', 'deck', 'id', 'logoUrl', 'name', 'number', 'state', 'summary', 'verified', 'website'])
      expect(page).toMatchObject({ verified: true, deck: { pages: 2 } })
      const serialized = JSON.stringify(page)
      for (const secret of [coach.name, coach.email, '555-0100']) expect(serialized).not.toContain(secret)

      const suspended = await createTeam({ suspendedAt: new Date() })
      expect(await queryPublicTeam(suspended.number)).toBeNull()
      expect(await queryPublicTeam(999_999_999)).toBeNull()
      expect((await queryPublicTeam((await createTeam()).number))!.deck).toBeNull()
    }),
  )

  it(
    'a report is stored and every admin is notified; suspended pages can’t be reported',
    dbTest(async () => {
      const team = await createTeam()
      const admin = await createUser({ isAdmin: true })
      const report = await createReport(null, { teamNumber: team.number, reason: 'spam', details: 'Looks automated.', email: 'parent@example.com' })
      const [row] = await getDb().select().from(reports).where(eq(reports.id, report.id))
      expect(row).toMatchObject({ teamId: team.id, reason: 'spam', reporterEmail: 'parent@example.com', reporterUserId: null, status: 'open' })
      const adminNotes = await getDb().select().from(notifications).where(eq(notifications.userId, admin.id))
      expect(adminNotes.map((n) => n.type)).toEqual(['report.created'])
      expect(adminNotes[0].title).toBe(`Team ${team.number} · ${team.name} was reported`)

      const signedIn = await createUser()
      const mine = await createReport(await loadViewer(signedIn.id), { teamNumber: team.number, reason: 'other', details: null, email: null })
      const [mineRow] = await getDb().select().from(reports).where(eq(reports.id, mine.id))
      expect(mineRow).toMatchObject({ reporterUserId: signedIn.id, reporterEmail: signedIn.email })

      const suspended = await createTeam({ suspendedAt: new Date() })
      await expectAppError(createReport(null, { teamNumber: suspended.number, reason: 'spam', details: null, email: null }), 'NOT_FOUND')
    }),
  )
})
