import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { audit, listAuditEvents } from '@/lib/server/audit'
import { accountDeletionBlocker, updateProfile } from '@/lib/server/data/account'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/server/data/notifications'
import { getDb } from '@/lib/server/db'
import { notifyAdmins, notifySponsor, notifyTeam, notifyUsers } from '@/lib/server/notify'
import { notifications } from '@/lib/server/schema'
import { loadViewer } from '@/lib/server/viewer'
import { safeNext } from '@/lib/shared/sign-in'
import { requestOrigin } from '@/lib/shared/request-origin'

import { addSponsorMember, addTeamMember, createSponsor, createTeam, createUser, dbTest } from './helpers/db'

describe('notifications', () => {
  it(
    'fan out to every org member (except the actor) in one statement, and never cross users',
    dbTest(async () => {
      const team = await createTeam()
      const [a, b, outsider] = [await createUser(), await createUser(), await createUser()]
      await addTeamMember(team.id, a.id)
      await addTeamMember(team.id, b.id)
      expect(await notifyTeam(team.id, { type: 't', title: 'Hello team' }, { exceptUserId: a.id })).toBe(1)

      const sponsor = await createSponsor()
      await addSponsorMember(sponsor.id, outsider.id)
      expect(await notifySponsor(sponsor.id, { type: 's', title: 'Hello company', href: '/inbox' })).toBe(1)
      expect(await notifyUsers([a.id, a.id], { type: 'u', title: 'Just you' })).toBe(1)
      await createUser({ isAdmin: true })
      expect(await notifyAdmins({ type: 'a', title: 'Admins' })).toBeGreaterThanOrEqual(1)

      const viewerB = (await loadViewer(b.id))!
      const viewerOutsider = (await loadViewer(outsider.id))!
      expect(viewerB.unreadCount).toBe(1)
      const [mine] = await listNotifications(viewerB)
      expect(mine.title).toBe('Hello team')

      // Someone else's notification id changes nothing.
      expect(await markNotificationRead(viewerOutsider, mine.id)).toBe(0)
      const [still] = await getDb().select().from(notifications).where(eq(notifications.id, mine.id))
      expect(still.readAt).toBeNull()

      expect(await markNotificationRead(viewerB, mine.id)).toBe(1)
      expect(await markNotificationRead(viewerB, mine.id)).toBe(0)
      expect((await loadViewer(b.id))!.unreadCount).toBe(0)
      expect(await markAllNotificationsRead(viewerOutsider)).toBe(1)
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
      expect(await accountDeletionBlocker((await loadViewer(solo.id))!)).toBeNull()

      const sponsor = await createSponsor({ name: 'Solo Co' })
      const rep = await createUser()
      await addSponsorMember(sponsor.id, rep.id)
      expect(await accountDeletionBlocker((await loadViewer(rep.id))!)).toEqual({ kind: 'sponsor', name: 'Solo Co' })

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

  it('redirects on the host the browser used', () => {
    const req = new Request('http://localhost:3000/auth/callback', { headers: { host: '127.0.0.1:3000' } })
    expect(requestOrigin(req)).toBe('http://127.0.0.1:3000')
    const proxied = new Request('http://internal/x', { headers: { host: 'internal', 'x-forwarded-host': 'ftcpitfund.com', 'x-forwarded-proto': 'https' } })
    expect(requestOrigin(proxied)).toBe('https://ftcpitfund.com')
  })
})
