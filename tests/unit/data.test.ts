import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { audit, listAuditEvents } from '@/lib/server/audit'
import { accountDeletionBlocker, updateProfile } from '@/lib/server/data/account'
import { listNotifications, markNotificationRead } from '@/lib/server/data/notifications'
import { getDb } from '@/lib/server/db'
import { notifyAdmins, notifySponsor, notifyTeam, notifyUsers, resolveNotifications } from '@/lib/server/notify'
import { notifications } from '@/lib/server/schema'
import { loadViewer, signedInWithEmailCode } from '@/lib/server/viewer'
import { safeNext } from '@/lib/shared/sign-in'
import { requestOrigin } from '@/lib/shared/request-origin'

import { subjectKey } from '@/lib/shared/notifications'

import { addSponsorMember, addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'

describe('notifications', () => {
  it(
    'fan out to every org member (except the actor) in one statement, and never cross users',
    dbTest(async () => {
      const team = await createTeam()
      const [a, b, outsider] = [await createUser(), await createUser(), await createUser()]
      await addTeamMember(team.id, a.id, 'owner')
      await addTeamMember(team.id, b.id, 'editor')
      expect(await notifyTeam(team.id, { type: 'team.join_request', title: 'Hello team' }, { exceptUserId: a.id })).toBe(1)

      const sponsor = await createSponsor()
      await addSponsorMember(sponsor.id, outsider.id)
      expect(await notifySponsor(sponsor.id, { type: 'pitch.received', title: 'Hello company', href: '/inbox' })).toBe(1)
      expect(await notifyUsers([a.id, a.id], { type: 'u', title: 'Just you' })).toBe(1)
      await createUser({ isAdmin: true })
      expect(await notifyAdmins({ type: 'admin.pitch_submitted', title: 'Admins' })).toBeGreaterThanOrEqual(1)

      const viewerB = (await loadViewer(b.id))!
      const viewerOutsider = (await loadViewer(outsider.id))!
      expect(viewerB.actionCount).toBe(1)
      const [mine] = await listNotifications(viewerB)
      expect(mine.title).toBe('Hello team')

      // Someone else's notification id changes nothing.
      expect(await markNotificationRead(viewerOutsider, mine.id)).toBe(0)
      const [still] = await getDb().select().from(notifications).where(eq(notifications.id, mine.id))
      expect(still.readAt).toBeNull()

      expect(await markNotificationRead(viewerB, mine.id)).toBe(1)
      expect(await markNotificationRead(viewerB, mine.id)).toBe(0)
      expect((await loadViewer(b.id))!.actionCount).toBe(0)
    }),
  )

  it(
    'only count work: news is stored but never reaches the bell',
    dbTest(async () => {
      const team = await createTeam()
      const person = await createUser()
      await addTeamMember(team.id, person.id)
      // "Someone joined" is news: it is written (email is only ever a copy of it) but it is not
      // something the coach has to do, so the badge stays at zero.
      await notifyTeam(team.id, { type: 'team.member_joined', title: 'Sam Patel joined' })
      expect((await loadViewer(person.id))!.actionCount).toBe(0)
      expect(await getDb().select().from(notifications).where(eq(notifications.userId, person.id))).toHaveLength(1)

      await notifyTeam(team.id, { type: 'pitch.sent_back', title: 'Changes requested' })
      expect((await loadViewer(person.id))!.actionCount).toBe(1)
    }),
  )

  it(
    'clear an action item for everyone once the thing it points at is handled',
    dbTest(async () => {
      const team = await createTeam()
      const [owner, editor] = [await createUser(), await createUser()]
      await addTeamMember(team.id, owner.id, 'owner')
      await addTeamMember(team.id, editor.id, 'editor')
      const subject = subjectKey('join', crypto.randomUUID())
      await notifyTeam(team.id, { type: 'team.join_request', title: 'Sam wants to join', subjectKey: subject })
      expect((await loadViewer(owner.id))!.actionCount).toBe(1)
      expect((await loadViewer(editor.id))!.actionCount).toBe(1)

      // The owner decides the request; it stops being work for the other coach too, without them
      // having to open the bell.
      expect(await resolveNotifications(subject)).toBe(2)
      expect((await loadViewer(owner.id))!.actionCount).toBe(0)
      expect((await loadViewer(editor.id))!.actionCount).toBe(0)
    }),
  )
})

describe('account', () => {
  it(
    'blocks deleting the last member of a team or company, and nobody else',
    dbTest(async () => {
      const team = await createTeam()
      const solo = await createUser()
      await addTeamMember(team.id, solo.id)
      expect(await accountDeletionBlocker((await loadViewer(solo.id))!)).toMatchObject({ kind: 'team' })

      const partner = await createUser()
      await addTeamMember(team.id, partner.id)
      // The first member owns the team. Deleting the owner's account would leave it with nobody who can
      // invite, remove, transfer or approve join requests, so the owner has to hand it over first.
      expect(await accountDeletionBlocker((await loadViewer(solo.id))!)).toMatchObject({ kind: 'team', reason: 'owner' })
      expect(await accountDeletionBlocker((await loadViewer(partner.id))!)).toBeNull()

      const sponsor = await createSponsor({ name: 'Solo Co' })
      const rep = await createUser()
      await addSponsorMember(sponsor.id, rep.id)
      expect(await accountDeletionBlocker((await loadViewer(rep.id))!)).toEqual({ kind: 'sponsor', name: 'Solo Co', reason: 'only-member' })

      const rep2 = await createUser()
      await addSponsorMember(sponsor.id, rep2.id)
      expect(await accountDeletionBlocker((await loadViewer(rep.id))!)).toMatchObject({ kind: 'sponsor', reason: 'owner' })
      expect(await accountDeletionBlocker((await loadViewer(rep2.id))!)).toBeNull()

      const loner = await createUser()
      expect(await accountDeletionBlocker((await loadViewer(loner.id))!)).toBeNull()
    }),
  )

  it(
    'updates only the viewer’s own profile, and job title only when asked',
    dbTest(async () => {
      const user = await createUser({ jobTitle: 'Engineer' })
      const row = await updateProfile((await loadViewer(user.id))!, { name: 'New Name', phone: '555 0100' })
      expect(row).toEqual({ name: 'New Name', phone: '555 0100', jobTitle: 'Engineer' })
    }),
  )

  it(
    'audit events are appended and listed in order',
    dbTest(async () => {
      const user = await createUser()
      const entityId = crypto.randomUUID()
      await audit([
        { actorId: user.id, action: 'pitch.created', entityType: 'pitch', entityId },
        { actorId: null, action: 'pitch.approved', entityType: 'pitch', entityId, data: { note: 'ok' } },
      ])
      const events = await listAuditEvents('pitch', entityId)
      expect(events.map((e) => e.action)).toEqual(['pitch.created', 'pitch.approved'])
    }),
  )
})

describe('who counts as signed in', () => {
  it('accepts only sessions that came from the emailed code, never a password sign-up or a missing amr', () => {
    expect(signedInWithEmailCode({ amr: [{ method: 'otp' }] })).toBe(true)
    expect(signedInWithEmailCode({ amr: [{ method: 'magiclink' }] })).toBe(true)
    expect(signedInWithEmailCode({ amr: [{ method: 'password' }, { method: 'otp' }] })).toBe(true)
    // POST /auth/v1/signup with autoconfirm returns amr [{ method: 'password' }] for an address nobody verified.
    expect(signedInWithEmailCode({ amr: [{ method: 'password' }] })).toBe(false)
    expect(signedInWithEmailCode({ amr: [] })).toBe(false)
    expect(signedInWithEmailCode({})).toBe(false)
    expect(signedInWithEmailCode({ amr: 'otp' as never })).toBe(false)
  })
})

describe('redirect safety', () => {
  it('only allows same-site relative paths after sign-in', () => {
    expect(safeNext('/pitches?tab=sent')).toBe('/pitches?tab=sent')
    expect(safeNext('//evil.example')).toBeNull()
    expect(safeNext('/\\evil.example')).toBeNull()
    expect(safeNext('https://evil.example')).toBeNull()
    expect(safeNext('/login')).toBeNull()
    expect(safeNext('/api/dev/sign-in')).toBeNull()
    expect(safeNext(undefined)).toBeNull()
  })

  it('rejects tab, CR and LF smuggled after the slash (the URL parser strips them, leaving //host)', () => {
    for (const next of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/\t\\evil.example', '/\t/\t/evil.example', '/pitches\u0000']) {
      expect(safeNext(next), JSON.stringify(next)).toBeNull()
    }
    expect(new URL('/\t/evil.example', 'https://pitfund.org').origin).toBe('https://evil.example')
    expect(safeNext('/pitches?tab=sent#top')).toBe('/pitches?tab=sent#top')
  })

  it('redirects on the host the browser used', () => {
    const req = new Request('http://localhost:3000/auth/callback', { headers: { host: '127.0.0.1:3000' } })
    expect(requestOrigin(req)).toBe('http://127.0.0.1:3000')
    const proxied = new Request('http://internal/x', { headers: { host: 'internal', 'x-forwarded-host': 'ftcpitfund.com', 'x-forwarded-proto': 'https' } })
    expect(requestOrigin(proxied)).toBe('https://ftcpitfund.com')
  })
})
