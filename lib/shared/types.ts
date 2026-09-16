/* Enum types shared with the client (the schema itself is server-only). */

export const PITCH_STATUSES = ['draft', 'in_review', 'changes_requested', 'rejected', 'sent', 'matched', 'declined', 'withdrawn'] as const
export type PitchStatus = (typeof PITCH_STATUSES)[number]

/**
 * Both teams and companies move through the same gate: they fill their profile in (`draft`), send it
 * for review (`pending`), and only an `approved` org reaches the app. Suspension is separate from the
 * gate but shares the column, because a suspended org is equally locked out.
 */
export const ORG_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'suspended'] as const
export type OrgStatus = (typeof ORG_STATUSES)[number]

/** An org is one shared account, but one member owns it: only they can change who is on it. */
export const ORG_ROLES = ['owner', 'editor'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const SUPPORT_TYPES = ['funding', 'equipment', 'software', 'mentorship', 'other'] as const
export type SupportType = (typeof SUPPORT_TYPES)[number]
