import { and, eq } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import type { TeamViewer } from '@/lib/server/authz'
import {
  checkStagedDeck,
  createTeam as createTeamForViewer,
  decideJoinRequest,
  finalizeDeck,
  leaveTeam,
  listPendingJoinRequests,
  lookupTeamNumber,
  removeTeamMember,
  requestToJoinTeam,
  transferTeamOwnership,
  updateTeamProfile,
} from '@/lib/server/data/teams'
import { getDb } from '@/lib/server/db'
import { mapDbError } from '@/lib/server/result'
import { ftcTeamCache, teamJoinRequests, teamMembers, teams, users } from '@/lib/server/schema'
import { BUCKETS, downloadObject, publicUrl, removeObjects, uploadObject } from '@/lib/server/storage'
import { assertOwnStagingPath, hasPdfMagic, imageKind, readReceipt, signReceipt, verifyImageBytes, verifyPdfBytes } from '@/lib/server/uploads'
import { loadViewer } from '@/lib/server/viewer'
import { DECK_MESSAGES, MAX_PDF_BYTES } from '@/lib/shared/team'

import { addSponsorMember, addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'
import { expectAppError } from './helpers/errors'

const viewerOf = async (userId: string) => (await loadViewer(userId))!
const teamViewerOf = async (userId: string) => (await loadViewer(userId)) as TeamViewer

async function coachOn(team: { id: string }) {
  const user = await createUser()
  await addTeamMember(team.id, user.id)
  return teamViewerOf(user.id)
}

async function pdfWithPages(pages: number) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([612, 792])
  return doc.save()
}

const PNG_1PX = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
)

describe('team creation', () => {
  it(
    'creates the team, the membership and terms acceptance; "matched" needs a FIRST record',
    dbTest(async () => {
      const user = await createUser({ acceptedTermsAt: null })
      const number = 700_000 + Math.floor(Math.random() * 99_999)
      const team = await createTeamForViewer(await viewerOf(user.id), { number, name: 'Fresh', location: 'Austin, Texas, USA', source: 'matched' })
      const [row] = await getDb().select().from(teams).where(eq(teams.id, team.id))
      expect(row.recordStatus).toBe('unchecked')
      const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, user.id))
      expect(member.teamId).toBe(team.id)
      const [person] = await getDb().select({ acceptedTermsAt: users.acceptedTermsAt }).from(users).where(eq(users.id, user.id))
      expect(person.acceptedTermsAt).not.toBeNull()

      const other = await createUser()
      const recorded = number + 1
      await getDb().insert(ftcTeamCache).values({ number: recorded, name: 'Recorded', city: 'Austin', state: 'TX', country: 'USA', source: 'first' })
      const matched = await createTeamForViewer(await viewerOf(other.id), { number: recorded, name: 'Recorded', location: 'Austin, Texas, USA', source: 'matched' })
      const [matchedRow] = await getDb().select().from(teams).where(eq(teams.id, matched.id))
      expect(matchedRow).toMatchObject({ recordStatus: 'matched', country: 'USA' })

      // One team per person, one account per team number.
      await expectAppError(createTeamForViewer(await viewerOf(user.id), { number: number + 2, name: 'Second', location: 'A, B', source: 'manual' }), 'CONFLICT')
      const third = await createUser()
      const duplicate = await createTeamForViewer(await viewerOf(third.id), { number, name: 'Dup', location: 'A, B', source: 'manual' }).catch((e: unknown) => e)
      expect(mapDbError(duplicate, { conflict: { teams_number_key: 'taken' } })).toMatchObject({ code: 'CONFLICT', message: 'taken' })
    }),
  )

  it(
    'lookup reports a team already on FTC Pitfund before asking FIRST',
    dbTest(async () => {
      const team = await createTeam({ suspendedAt: new Date() })
      const result = await lookupTeamNumber(team.number, { fetch: () => Promise.reject(new Error('must not be called')) })
      expect(result).toMatchObject({ status: 'on_pitfund', team: { id: team.id, suspended: true } })
    }),
  )

  it(
    'profile updates touch only the viewer’s team',
    dbTest(async () => {
      const team = await createTeam()
      const bystander = await createTeam({ name: 'Untouched' })
      const coach = await coachOn(team)
      const profile = await updateTeamProfile(coach, { name: 'Renamed', location: 'Dallas, Texas, USA', summary: 'One line.', website: 'https://example.org', instagram: null })
      expect(profile).toMatchObject({ id: team.id, name: 'Renamed', summary: 'One line.', website: 'https://example.org' })
      const [still] = await getDb().select({ name: teams.name }).from(teams).where(eq(teams.id, bystander.id))
      expect(still.name).toBe('Untouched')
    }),
  )
})

describe('members', () => {
  it(
    'the owner can’t be removed and can’t walk away without handing the team over',
    dbTest(async () => {
      const team = await createTeam()
      const owner = await coachOn(team)
      // Nobody is left to run the team, so this is refused with an explanation, not a silent no-op.
      await expectAppError(leaveTeam(owner), 'CONFLICT', { message: /only member/ })

      const editor = await coachOn(team)
      await expectAppError(removeTeamMember(owner, owner.id), 'VALIDATION')
      await expect(removeTeamMember(owner, editor.id)).resolves.toMatchObject({ userId: editor.id })
      await expectAppError(removeTeamMember(owner, editor.id), 'NOT_FOUND')

      // With someone else on the team the owner still can’t just leave.
      const second = await coachOn(team)
      await expectAppError(leaveTeam(owner), 'CONFLICT', { message: /Make another coach the owner/ })

      // An editor cannot remove the owner, even by calling the data function directly — the
      // guard in front of it is not the only thing standing between the two.
      await expectAppError(removeTeamMember(second, owner.id), 'NOT_FOUND')

      // Hand it over, and now the old owner is an ordinary member who can leave.
      await expect(transferTeamOwnership(owner, second.id)).resolves.toMatchObject({ userId: second.id })
      const demoted = await teamViewerOf(owner.id)
      const promoted = await teamViewerOf(second.id)
      expect(demoted.team.role).toBe('editor')
      expect(promoted.team.role).toBe('owner')
      await expect(leaveTeam(demoted)).resolves.toEqual({ teamId: team.id })

      const remaining = await getDb().select({ userId: teamMembers.userId }).from(teamMembers).where(eq(teamMembers.teamId, team.id))
      expect(remaining.map((r) => r.userId)).toEqual([second.id])

      // Removing someone on another team does nothing.
      const otherTeam = await createTeam()
      const outsider = await coachOn(otherTeam)
      await expectAppError(removeTeamMember(promoted, outsider.id), 'NOT_FOUND')
      await expectAppError(transferTeamOwnership(promoted, outsider.id), 'NOT_FOUND')
      await expectAppError(transferTeamOwnership(promoted, promoted.id), 'VALIDATION')
    }),
  )
})

describe('join requests', () => {
  it(
    'approve adds the member once; decline doesn’t; answered requests can’t be answered again',
    dbTest(async () => {
      const team = await createTeam()
      const coach = await coachOn(team)
      const joiner = await createUser()
      const request = await requestToJoinTeam(await viewerOf(joiner.id), team.id)
      expect(request.members.map((m) => m.userId)).toEqual([coach.id])
      await expectAppError(requestToJoinTeam(await viewerOf(joiner.id), team.id), 'CONFLICT', { message: 'You’ve already asked to join this team.' })
      expect((await listPendingJoinRequests(coach)).map((r) => r.userId)).toEqual([joiner.id])

      // A coach of a different team can't answer it.
      const stranger = await coachOn(await createTeam())
      await expectAppError(decideJoinRequest(stranger, request.requestId, 'approve'), 'CONFLICT')

      await expect(decideJoinRequest(coach, request.requestId, 'approve')).resolves.toMatchObject({ userId: joiner.id })
      const members = await getDb().select().from(teamMembers).where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, joiner.id)))
      expect(members).toHaveLength(1)
      await expectAppError(decideJoinRequest(coach, request.requestId, 'decline'), 'CONFLICT')
      expect(await listPendingJoinRequests(coach)).toEqual([])

      const declined = await createUser()
      const second = await requestToJoinTeam(await viewerOf(declined.id), team.id)
      await decideJoinRequest(coach, second.requestId, 'decline')
      const [row] = await getDb().select().from(teamJoinRequests).where(eq(teamJoinRequests.id, second.requestId))
      expect(row).toMatchObject({ status: 'declined', decidedBy: coach.id })
      expect(await getDb().select().from(teamMembers).where(eq(teamMembers.userId, declined.id))).toEqual([])
    }),
  )

  it(
    'people already in an org, suspended teams and people who joined a company meanwhile are refused',
    dbTest(async () => {
      const team = await createTeam()
      const coach = await coachOn(team)
      await expectAppError(requestToJoinTeam(coach, (await createTeam()).id), 'CONFLICT')
      const joiner = await createUser()
      await expectAppError(requestToJoinTeam(await viewerOf(joiner.id), (await createTeam({ suspendedAt: new Date() })).id), 'FORBIDDEN')

      const request = await requestToJoinTeam(await viewerOf(joiner.id), team.id)
      await addSponsorMember((await createSponsor()).id, joiner.id)
      await expectAppError(decideJoinRequest(coach, request.requestId, 'approve'), 'CONFLICT', { message: /joined a company/ })
    }),
  )
})

describe('deck verification', () => {
  it('checks magic bytes, parseability, size and page count with the exact messages', async () => {
    await expect(verifyPdfBytes(await pdfWithPages(5))).resolves.toMatchObject({ pages: 5 })
    await expect(verifyPdfBytes(await pdfWithPages(8))).rejects.toMatchObject({ code: 'VALIDATION', message: DECK_MESSAGES.tooManyPages(8) })
    expect(DECK_MESSAGES.tooManyPages(8)).toBe('This PDF has 8 pages. The limit is 5.')
    await expect(verifyPdfBytes(new TextEncoder().encode('<!doctype html><title>x</title>'))).rejects.toMatchObject({ message: DECK_MESSAGES.notPdf })
    const valid = await pdfWithPages(1)
    const corrupt = new Uint8Array(4000)
    corrupt.set(valid.subarray(0, 16))
    expect(hasPdfMagic(corrupt)).toBe(true)
    await expect(verifyPdfBytes(corrupt)).rejects.toMatchObject({ message: DECK_MESSAGES.notPdf })
    await expect(verifyPdfBytes(new Uint8Array(0))).rejects.toMatchObject({ message: DECK_MESSAGES.notPdf })
    await expect(verifyPdfBytes(new Uint8Array(MAX_PDF_BYTES + 1))).rejects.toMatchObject({ message: DECK_MESSAGES.tooLarge(MAX_PDF_BYTES + 1) })
  })

  it('accepts only raster images for logos and thumbnails', () => {
    expect(imageKind(PNG_1PX)).toEqual({ ext: 'png', contentType: 'image/png' })
    expect(() => verifyImageBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo')).toThrow('That logo isn’t a PNG, JPEG or WebP image.')
    expect(() => verifyImageBytes(new Uint8Array(0), 'logo')).toThrow('That logo is empty.')
  })

  it('staging paths must be this team’s own upload names', () => {
    const prefix = 'teams/11111111-1111-4111-8111-111111111111'
    const own = `${prefix}/upload-22222222-2222-4222-8222-222222222222.pdf`
    expect(() => assertOwnStagingPath(own, prefix)).not.toThrow()
    for (const path of [
      own.replace('11111111-1111', '33333333-3333'),
      `${prefix}/verified-22222222-2222-4222-8222-222222222222.pdf`,
      `${prefix}/../teams/x/upload-22222222-2222-4222-8222-222222222222.pdf`,
      `${prefix}/upload-22222222-2222-4222-8222-222222222222.html`,
    ]) {
      expect(() => assertOwnStagingPath(path, prefix), path).toThrow(/isn’t yours/)
    }
  })

  it('receipts are signed, scoped to one team, and expire', () => {
    const now = Date.now()
    const token = signReceipt({ scope: 'team:a', path: 'teams/a/verified-x.pdf', pages: 3, bytes: 10 }, 60_000, now)
    expect(readReceipt(token, 'team:a', now)).toMatchObject({ pages: 3, bytes: 10 })
    expect(() => readReceipt(token, 'team:b', now)).toThrow(/isn’t yours/)
    expect(() => readReceipt(token, 'team:a', now + 120_000)).toThrow(/expired/)
    const [payload, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), pages: 1 })).toString('base64url')
    expect(() => readReceipt(`${forged}.${signature}`, 'team:a', now)).toThrow(/expired/)
    expect(() => readReceipt('garbage', 'team:a', now)).toThrow(/expired/)
  })

  it(
    'finalizeDeck refuses missing consent, another team’s receipt and another team’s thumbnail',
    dbTest(async () => {
      const team = await createTeam()
      const coach = await coachOn(team)
      const other = await createTeam()
      const thumbPath = `teams/${team.id}/upload-${crypto.randomUUID()}.webp`
      const receipt = signReceipt({ scope: `team:${team.id}`, path: `teams/${team.id}/verified-x.pdf`, pages: 2, bytes: 100 })
      await expectAppError(finalizeDeck(coach, { receipt, thumbPath, consent: false }), 'VALIDATION', { field: 'consent' })
      const foreignReceipt = signReceipt({ scope: `team:${other.id}`, path: `teams/${other.id}/verified-x.pdf`, pages: 2, bytes: 100 })
      await expectAppError(finalizeDeck(coach, { receipt: foreignReceipt, thumbPath, consent: true }), 'NOT_FOUND')
      const foreignThumb = `teams/${other.id}/upload-${crypto.randomUUID()}.webp`
      await expectAppError(finalizeDeck(coach, { receipt, thumbPath: foreignThumb, consent: true }), 'NOT_FOUND')
      await expectAppError(checkStagedDeck(coach, `teams/${other.id}/upload-${crypto.randomUUID()}.pdf`), 'NOT_FOUND')
    }),
  )

  it(
    'a staged deck is checked, published to the public bucket and set on the team (real storage)',
    dbTest(async () => {
      const team = await createTeam()
      const coach = await coachOn(team)
      const prefix = `teams/${team.id}`
      const stagedPdf = `${prefix}/upload-${crypto.randomUUID()}.pdf`
      const stagedThumb = `${prefix}/upload-${crypto.randomUUID()}.png`
      const published: string[] = []
      try {
        await uploadObject(BUCKETS.staging, stagedPdf, await pdfWithPages(3), 'application/pdf')
        await uploadObject(BUCKETS.staging, stagedThumb, PNG_1PX, 'image/png')
        const checked = await checkStagedDeck(coach, stagedPdf)
        expect(checked).toMatchObject({ pages: 3 })
        // The browser's staged object is gone; only the server-written copy remains.
        await expect(downloadObject(BUCKETS.staging, stagedPdf)).rejects.toThrow()

        const result = await finalizeDeck(coach, { receipt: checked.receipt, thumbPath: stagedThumb, consent: true })
        published.push(...result.published)
        expect(result.profile.deck).toMatchObject({ pages: 3 })
        const [row] = await getDb().select().from(teams).where(eq(teams.id, team.id))
        expect(row.pdfPath).toMatch(new RegExp(`^${prefix}/deck-[0-9a-f-]{36}\\.pdf$`))
        expect(row.pdfThumbPath).toMatch(/\/thumb-[0-9a-f-]{36}\.png$/)
        expect(row.mediaConsentAt).not.toBeNull()
        // Served publicly (a bucket named "public" can't use the authenticated download route).
        const served = await fetch(publicUrl(row.pdfPath)!)
        expect(served.status).toBe(200)
        expect(hasPdfMagic(new Uint8Array(await served.arrayBuffer()))).toBe(true)
        // A receipt works once: the verified copy has moved.
        await expectAppError(finalizeDeck(coach, { receipt: checked.receipt, thumbPath: stagedThumb, consent: true }), 'NOT_FOUND')

        // An 8-page file never gets a receipt.
        const eight = `${prefix}/upload-${crypto.randomUUID()}.pdf`
        await uploadObject(BUCKETS.staging, eight, await pdfWithPages(8), 'application/pdf')
        await expectAppError(checkStagedDeck(coach, eight), 'VALIDATION', { message: DECK_MESSAGES.tooManyPages(8) })
      } finally {
        await removeObjects(BUCKETS.public, published).catch(() => null)
        await removeObjects(BUCKETS.staging, [stagedPdf, stagedThumb]).catch(() => null)
      }
    }),
  )
})
