import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { DIRECTORY_PAGE_SIZE, queryDirectory, queryDirectorySponsor } from '@/lib/server/data/directory'
import { queryPublicTeam } from '@/lib/server/data/public-team'
import { createReport } from '@/lib/server/data/reports'
import { getDb } from '@/lib/server/db'
import { notifications, reports, sponsors } from '@/lib/server/schema'
import { loadViewer } from '@/lib/server/viewer'

import { addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'
import { expectAppError } from './helpers/errors'

const query = (q: string, extra: Partial<Parameters<typeof queryDirectory>[0]> = {}) => queryDirectory({ q, after: null, before: null, ...extra })

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
    'pages by cursor when nothing is being searched for',
    dbTest(async () => {
      // The seed leaves companies in the database; paging is about the whole approved list, so clear
      // it first. The surrounding transaction is rolled back, so the seed survives the test.
      await getDb().delete(sponsors)
      const tag = `Pg${crypto.randomUUID().slice(0, 8)}`
      for (let i = 0; i < DIRECTORY_PAGE_SIZE + 3; i++) {
        await createSponsor({ name: `${tag} ${String(i).padStart(2, '0')}` })
      }
      const first = await query('')
      expect(first.items).toHaveLength(DIRECTORY_PAGE_SIZE)
      expect(first.prevCursor).toBeNull()
      expect(first.nextCursor).not.toBeNull()
      const second = await query('', { after: first.nextCursor })
      expect(second.items.map((i) => i.name)).toEqual([`${tag} 25`, `${tag} 26`, `${tag} 27`])
      expect(second.nextCursor).toBeNull()
      const back = await query('', { before: second.prevCursor })
      expect(back.items.map((i) => i.id)).toEqual(first.items.map((i) => i.id))
      expect(back.prevCursor).toBeNull()
      expect((await query('', { after: 'not-a-cursor' })).items).toHaveLength(DIRECTORY_PAGE_SIZE)
    }),
  )

  it(
    'finds companies whose names were typed wrong, best match first',
    dbTest(async () => {
      await getDb().delete(sponsors)
      const ribosome = await createSponsor({ name: 'Ribosome Energy' })
      const keystone = await createSponsor({ name: 'BioBuzz Foundation' })
      const summit = await createSponsor({ name: 'Summit Manufacturing' })

      /*
       * The whole point: one wrong letter used to produce an empty page. The misspellings have to
       * stay misspellings *of these fixtures* — a blanket rename of the company names once left the
       * typos pointing at names that no longer existed, and the test failed for that rather than
       * for anything the search did.
       */
      const names = async (q: string) => (await query(q)).items.map((i) => i.id)
      expect(await names('ribosme')).toContain(ribosome.id)
      expect(await names('ribosome energy')).toEqual([ribosome.id])
      expect(await names('biobuz foundation')).toContain(keystone.id)
      expect(await names('sumit manufacturng')).toContain(summit.id)
      expect(await names('BioBzz')).toContain(keystone.id)

      // Best match first, not merely "somewhere in the results".
      expect((await names('biobuzz'))[0]).toBe(keystone.id)
      expect((await names('summit'))[0]).toBe(summit.id)

      // A prefix beats a better-scoring match elsewhere in the name.
      const foundation = await createSponsor({ name: 'BioBuzz Trust' })
      expect((await names('biobuzz t'))[0]).toBe(foundation.id)

      // Below the threshold is nothing at all, not a page of near-misses.
      expect(await names('zzzzzzzz')).toEqual([])
      expect(await names('plumbing')).toEqual([])

      // A wildcard is not a wildcard: "%" on its own matches nothing rather than everything. A
      // stray one next to a real word is just a typo, and fuzzy matching is allowed to see past it.
      expect((await query('%')).items).toEqual([])
      expect((await query('_')).items).toEqual([])
      expect(await names('BioBuzz%')).toContain(keystone.id)

      // Searching never pages: the results are ranked, so a cursor on the alphabetical key is
      // meaningless. The page says how many matched instead.
      expect(await query('biobuzz')).toMatchObject({ nextCursor: null, prevCursor: null })
    }),
  )

  it(
    'narrows the list to what this team has and hasn’t pitched',
    dbTest(async () => {
      await getDb().delete(sponsors)
      const untouched = await createSponsor({ name: 'Aardvark Co' })
      const drafted = await createSponsor({ name: 'Bravo Co' })
      const answered = await createSponsor({ name: 'Charlie Co' })

      const ids = (page: { items: Array<{ id: string }> }) => page.items.map((i) => i.id)
      expect(ids(await query('', { filter: { kind: 'not_pitched', ids: [drafted.id, answered.id] } }))).toEqual([untouched.id])
      expect(ids(await query('', { filter: { kind: 'in_progress', ids: [drafted.id] } }))).toEqual([drafted.id])
      expect(ids(await query('', { filter: { kind: 'pitched', ids: [answered.id] } }))).toEqual([answered.id])

      // Nothing pitched yet: "not yet pitched" is everything, and the other two are empty rather
      // than falling back to the whole directory.
      expect(ids(await query('', { filter: { kind: 'not_pitched', ids: [] } }))).toHaveLength(3)
      expect(ids(await query('', { filter: { kind: 'pitched', ids: [] } }))).toEqual([])
      expect(ids(await query('', { filter: { kind: 'in_progress', ids: [] } }))).toEqual([])
    }),
  )
})

describe('public team page', () => {
  it(
    'returns public fields only, and nothing for suspended or missing teams',
    dbTest(async () => {
      const team = await createTeam({ summary: 'We build robots.', website: 'https://example.org', status: 'approved', pdfPath: 't/deck.pdf', pdfPages: 2, pdfBytes: 10, pdfUpdatedAt: new Date() })
      const coach = await createUser({ name: 'Private Coach Name', phone: '(512) 555-0100', email: `private-${crypto.randomUUID()}@pitfund.test` })
      await addTeamMember(team.id, coach.id)

      const page = await queryPublicTeam(team.number)
      expect(Object.keys(page!).sort()).toEqual(['deck', 'id', 'instagram', 'location', 'logoUrl', 'name', 'number', 'summary', 'verified', 'website'])
      expect(page).toMatchObject({ verified: true, deck: { pages: 2 } })
      const serialized = JSON.stringify(page)
      for (const secret of [coach.name, coach.email, '555-0100']) expect(serialized).not.toContain(secret)

      const suspended = await createTeam({ status: 'suspended', suspendedAt: new Date() })
      expect(await queryPublicTeam(suspended.number)).toBeNull()
      expect(await queryPublicTeam(999_999_999)).toBeNull()
      // A team that hasn't been approved has no page at all, so claiming a number gets you nothing.
      for (const status of ['draft', 'pending', 'rejected'] as const) {
        expect(await queryPublicTeam((await createTeam({ status })).number)).toBeNull()
      }
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
