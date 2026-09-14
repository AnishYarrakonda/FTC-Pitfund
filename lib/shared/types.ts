/* Enum types shared with the client (the schema itself is server-only). */

export const PITCH_STATUSES = ['draft', 'in_review', 'changes_requested', 'rejected', 'sent', 'matched', 'declined', 'withdrawn'] as const
export type PitchStatus = (typeof PITCH_STATUSES)[number]

export const SPONSOR_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const
export type SponsorStatus = (typeof SPONSOR_STATUSES)[number]

export const SUPPORT_TYPES = ['funding', 'equipment', 'software', 'mentorship', 'other'] as const
export type SupportType = (typeof SUPPORT_TYPES)[number]
