import 'server-only'

import { and, asc, eq } from 'drizzle-orm'

import { getDb } from './db'
import { auditEvents } from './schema'

export type AuditInput = {
  actorId: string | null
  action: string
  entityType: 'user' | 'team' | 'sponsor' | 'pitch' | 'invite' | 'join_request' | 'report' | 'email'
  entityId: string
  data?: Record<string, unknown>
}

/**
 * Append to audit_events. Every admin action and every org membership change is audited;
 * pitch events here also power the pitch timeline. Call inside the action's transaction.
 */
export async function audit(input: AuditInput | AuditInput[]) {
  const rows = (Array.isArray(input) ? input : [input]).map((e) => ({
    actorId: e.actorId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    data: e.data ?? {},
  }))
  if (rows.length === 0) return
  await getDb().insert(auditEvents).values(rows)
}

export async function listAuditEvents(entityType: AuditInput['entityType'], entityId: string) {
  return getDb()
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.entityType, entityType), eq(auditEvents.entityId, entityId)))
    .orderBy(asc(auditEvents.createdAt))
}
