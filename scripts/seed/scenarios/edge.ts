import { eq, inArray, sql } from 'drizzle-orm'

import { getDb } from '@/lib/server/db'
import { cronRuns, emailOutbox, notifications, pitches, reports, sponsors, teams, users } from '@/lib/server/schema'
import { BUCKETS, uploadObject } from '@/lib/server/storage'
import { personaEmail } from '@/lib/shared/personas'

import { generateDeckPdf, generateDeckThumbnail } from '../assets'
import { ago, DAY, HOUR, unbroken } from '../base'
import { seedSponsorId } from '../ids'
import { cronHistory, type World } from '../world'

/**
 * `edge`: the demo world pushed to every limit (plan §10) — 5,000-char unbroken strings in
 * every free-text field, a 10-question company, 60-char team names, a max-size 5-page PDF, 33 approved companies (two directory pages),
 * the email quota exhausted (95 sent in 24 h), a failed and a bounced email, a suspended team
 * and a withdrawn pitch (already in demo), and a daily job that hasn't run in 50 hours.
 */
export async function applyEdge(world: World) {
  const db = getDb()
  const { now } = world
  const long = (n: number, seed?: string) => unbroken(n, seed)

  // People: the longest names the schema allows, unbroken.
  await db.update(users).set({ name: long(120, 'Maximilian'), jobTitle: long(5000, 'Director') }).where(eq(users.id, world.personaId('coach')))
  await db.update(users).set({ name: long(120, 'Bartholomew'), jobTitle: long(5000, 'Partnerships') }).where(eq(users.id, world.personaId('sponsor')))

  // Teams: 60-char names, 160-char unbroken summaries, very long websites.
  const exodiusId = world.teamIds.get(31579)!
  for (const [number, id] of world.teamIds) {
    await db
      .update(teams)
      .set({
        name: long(60, number === 31579 ? 'Exodius' : 'Robotics'),
        summary: long(160, 'Summary'),
        website: `https://example.org/${long(300, 'path')}`,
        city: long(80, 'Llanfairpwllgwyngyll'),
      })
      .where(eq(teams.id, id))
  }

  // A max-size 5-page PDF on the coach's team.
  const pdf = await generateDeckPdf({ teamName: 'Exodius', teamNumber: 31579, location: 'Austin, TX', color: '#1F6F5C', pages: 5, maxSize: true })
  const pdfPath = `teams/${exodiusId}/deck-${crypto.randomUUID()}.pdf`
  const thumbPath = `teams/${exodiusId}/thumb-${crypto.randomUUID()}.png`
  await uploadObject(BUCKETS.public, pdfPath, pdf, 'application/pdf')
  await uploadObject(BUCKETS.public, thumbPath, generateDeckThumbnail('#1F6F5C'), 'image/png')
  await db.update(teams).set({ pdfPath, pdfThumbPath: thumbPath, pdfPages: 5, pdfBytes: pdf.byteLength, pdfUpdatedAt: now }).where(eq(teams.id, exodiusId))
  console.log(`  max-size deck: ${(pdf.byteLength / 1024 / 1024).toFixed(2)} MB`)

  // A suspended team that isn't a persona's.
  await db.update(teams).set({ suspendedAt: ago(now, DAY) }).where(eq(teams.id, world.teamIds.get(20443)!))

  // Companies: 10 questions at max length on the sponsor persona's company; long everything.
  const brightlineId = world.sponsorIds.get('Brightline Engineering')!
  await db
    .update(sponsors)
    .set({
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: `edge-${i + 1}`,
        prompt: long(200, `Question${i + 1}`),
        help: long(300, 'Help'),
        required: i % 3 !== 2,
      })),
    })
    .where(eq(sponsors.id, brightlineId))
  await db.update(sponsors).set({ name: sql`left(${sponsors.name} || ${long(60, 'Incorporated')}, 60)`, about: long(5000, 'About'), region: long(5000, 'Region'), statusNote: long(5000, 'Note') })

  // Enough approved companies for a second directory page (25 per page).
  await db.insert(sponsors).values(
    Array.from({ length: 24 }, (_, i) => ({
      id: seedSponsorId(`edge-${i + 1}`),
      name: `${String(i + 1).padStart(2, '0')} ${long(57, 'Sponsor')}`,
      website: `https://example.com/${long(300, 'sponsor')}`,
      city: long(80, 'City'),
      state: long(40, 'State'),
      region: long(5000, 'Region'),
      about: long(5000, 'About'),
      supportTypes: (['funding', 'equipment', 'software', 'mentorship', 'other'] as const).slice(0, 1 + (i % 5)),
      questions: [],
      status: 'approved' as const,
      decidedBy: world.personaId('admin'),
      decidedAt: ago(now, 10 * DAY),
      createdAt: ago(now, (40 + i) * HOUR),
    })),
  )

  // Pitches: every free-text field at 5,000 unbroken characters.
  await db
    .update(pitches)
    .set({
      answers: sql`(select coalesce(jsonb_agg(jsonb_set(a, '{answer}', to_jsonb(${long(5000, 'Answer')}::text))), '[]'::jsonb) from jsonb_array_elements(${pitches.answers}) a)`,
      askNote: long(5000, 'Ask'),
      reviewNote: sql`case when ${pitches.reviewNote} is null then null else ${long(5000, 'Review')} end`,
      declineReason: sql`case when ${pitches.declineReason} is null then null else ${long(5000, 'Decline')} end`,
      askAmountCents: sql`case when ${pitches.askType} = 'amount' then 99999999 else null end`,
    })

  await db.update(notifications).set({ title: long(200, 'Notification'), body: long(5000, 'Body') })
  await db.update(reports).set({ details: long(5000, 'Details'), reason: long(200, 'Reason') })

  // Email: exactly 95 sent in the rolling window, plus a failed and a bounced email.
  await db.delete(emailOutbox).where(inArray(emailOutbox.status, ['sent', 'bounced', 'failed']))
  const payload = { subject: 'Seeded', title: 'Seeded email', paragraphs: [long(5000, 'Email')] }
  await db.insert(emailOutbox).values(
    Array.from({ length: 94 }, (_, i) => {
      const sentAt = ago(now, (23 - (i % 23)) * HOUR + i * 1000)
      return { toEmail: personaEmail('coach'), template: 'notice', payload, priority: 1, status: 'sent' as const, attempts: 1, resendId: `edge-sent-${i}`, sentAt, sendAfter: sentAt, createdAt: sentAt }
    }),
  )
  const bouncedAt = ago(now, 2 * HOUR)
  await db.insert(emailOutbox).values([
    { toEmail: 'bounce@pitfund.test', template: 'notice', payload, priority: 1, status: 'bounced', attempts: 1, resendId: 'edge-bounced', sentAt: bouncedAt, sendAfter: bouncedAt, lastError: 'bounced: Mailbox does not exist', createdAt: bouncedAt },
    { toEmail: 'broken@pitfund.test', template: 'notice', payload, priority: 1, status: 'failed', attempts: 5, lastError: long(500, 'Error'), createdAt: ago(now, 3 * HOUR) },
    { toEmail: personaEmail('sponsor'), template: 'notice', payload, priority: 1, status: 'queued', sendAfter: ago(now, 60_000), createdAt: ago(now, 10 * 60_000) },
    { toEmail: personaEmail('admin'), template: 'notice', payload, priority: 3, status: 'queued', sendAfter: ago(now, 60_000), createdAt: ago(now, 9 * 60_000) },
  ])

  // The daily job last ran over 36 hours ago: System warns that it's stale.
  await db.delete(cronRuns)
  await db.insert(cronRuns).values(cronHistory(now, { lastRunHoursAgo: 50 }))
}

export async function run() {
  const { buildWorld } = await import('../world')
  const world = await buildWorld('demo')
  await applyEdge(world)
  return world
}
