import type { PitchStatus, SponsorStatus } from './types'

/* Human labels for statuses (plan §3.3). The UI never shows raw enum values. */

export type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'

export const PITCH_STATUS: Record<PitchStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'info' },
  changes_requested: { label: 'Needs changes', tone: 'warning' },
  rejected: { label: 'Not approved', tone: 'danger' },
  sent: { label: 'Sent', tone: 'accent' },
  matched: { label: 'Matched', tone: 'success' },
  declined: { label: 'Not a fit', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
}

/** Sponsors only ever see sent, matched and declined pitches, labelled for their side. */
export const SPONSOR_PITCH_STATUS: Partial<Record<PitchStatus, { label: string; tone: Tone }>> = {
  sent: { label: 'New', tone: 'accent' },
  matched: { label: 'Interested', tone: 'success' },
  declined: { label: 'Not a fit', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
}

export const SPONSOR_STATUS: Record<SponsorStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Not approved', tone: 'danger' },
  suspended: { label: 'Suspended', tone: 'danger' },
}

export const EMAIL_STATUS: Record<'queued' | 'sending' | 'sent' | 'failed' | 'bounced', { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'info' },
  sending: { label: 'Sending', tone: 'info' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  bounced: { label: 'Bounced', tone: 'warning' },
}

export const SUPPORT_TYPE_LABEL = {
  funding: 'Funding',
  equipment: 'Equipment',
  software: 'Software',
  mentorship: 'Mentorship',
  other: 'Other support',
} as const
