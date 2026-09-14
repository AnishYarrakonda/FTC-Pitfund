import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { reportReasonLabel } from '@/lib/shared/team'
import type { Viewer } from '@/lib/shared/viewer'

import { audit } from '../audit'
import { getDb } from '../db'
import { notifyAdmins } from '../notify'
import { AppError } from '../result'
import { reports, teams } from '../schema'

/*
 * "Report this page" on the public team page. Anyone can report (signed in or not); BotID
 * checks the request in the action. Admins are told in the app; prompt 3 adds their email.
 */

export type ReportRecord = { id: string; teamId: string; teamNumber: number; teamName: string; reason: string; details: string | null }

export async function createReport(viewer: Viewer | null, input: { teamNumber: number; reason: string; details: string | null; email: string | null }) {
  const [team] = await getDb()
    .select({ id: teams.id, number: teams.number, name: teams.name })
    .from(teams)
    .where(and(eq(teams.number, input.teamNumber), isNull(teams.suspendedAt)))
    .limit(1)
  if (!team) throw new AppError('NOT_FOUND', 'That team page doesn’t exist anymore.')
  const [row] = await getDb()
    .insert(reports)
    .values({
      teamId: team.id,
      reporterUserId: viewer?.id ?? null,
      reporterEmail: input.email ?? viewer?.email ?? null,
      reason: input.reason,
      details: input.details,
    })
    .returning({ id: reports.id })
  await audit({ actorId: viewer?.id ?? null, action: 'report.created', entityType: 'report', entityId: row.id, data: { teamId: team.id, reason: input.reason } })
  const report: ReportRecord = { id: row.id, teamId: team.id, teamNumber: team.number, teamName: team.name, reason: input.reason, details: input.details }
  await notifyAdminsOfReport(report)
  return report
}

/**
 * Tell admins about a new report. Prompt 2 writes the in-app notification; prompt 3 extends this
 * function to also enqueue the instant `admin-report` email (priority 2). Call it inside the
 * report's transaction.
 */
export async function notifyAdminsOfReport(report: ReportRecord) {
  return notifyAdmins({
    type: 'report.created',
    title: `Team ${report.teamNumber} · ${report.teamName} was reported`,
    body: reportReasonLabel(report.reason),
    href: '/admin?tab=reports',
  })
}
