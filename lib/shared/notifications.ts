/*
 * Which notifications are *work* and which are just news.
 *
 * Every state change still writes a notification row — an in-app notification is always written and
 * email is only ever a copy of it (CLAUDE.md). But the bell is not a feed: it shows only the rows a
 * person still has to do something about, and each one disappears when that thing is handled, by
 * whoever on the org handles it. Anything else happens as a toast at the moment it happens and then
 * lives on only as history.
 *
 * Shared with the client so the popover and the bell agree with the count in the viewer query.
 */

export const ACTIONABLE_TYPES = [
  // Someone is waiting on this org to let them in.
  'team.join_request',
  // A pitch came back for changes, or arrived and needs a decision.
  'pitch.sent_back',
  'pitch.received',
  // The org was refused and has to fix something before it can try again.
  'sponsor.rejected',
  'team.rejected',
  // Admin queue.
  'admin.team_submitted',
  'admin.company_submitted',
  'admin.pitch_submitted',
  'admin.report_opened',
] as const

export type ActionableType = (typeof ACTIONABLE_TYPES)[number]

export function isActionable(type: string): type is ActionableType {
  return (ACTIONABLE_TYPES as readonly string[]).includes(type)
}

/**
 * What a notification is *about*, so it can be cleared by the event that resolves it rather than by
 * a click. `subjectKey('join', requestId)` on the notification and the same key passed to
 * `resolveNotifications` when the request is decided.
 */
export function subjectKey(kind: 'join' | 'pitch' | 'team' | 'sponsor' | 'report', id: string) {
  return `${kind}:${id}`
}
