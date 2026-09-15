import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'

import type { Viewer } from '@/lib/shared/viewer'

import { getDb } from '../db'
import { notifications } from '../schema'

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  readAt: Date | null
  createdAt: Date
}

export async function listNotifications(viewer: Viewer, limit = 20): Promise<NotificationItem[]> {
  return getDb()
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, viewer.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

/** Only ever touches the viewer's own rows. Returns how many changed. */
export async function markNotificationRead(viewer: Viewer, id: string) {
  const rows = await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, viewer.id), isNull(notifications.readAt)))
    .returning({ id: notifications.id })
  return rows.length
}

export async function markAllNotificationsRead(viewer: Viewer) {
  const rows = await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, viewer.id), isNull(notifications.readAt)))
    .returning({ id: notifications.id })
  return rows.length
}
