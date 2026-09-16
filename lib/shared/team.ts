/* Team rules and copy shared by the server and the browser. */

export const MAX_TEAM_NAME_LENGTH = 60
export const MAX_SUMMARY_LENGTH = 160

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 5
/** Logos are resized in the browser; the source image may be up to 2 MB (plan §5 "Files"). */
export const MAX_LOGO_SOURCE_BYTES = 2 * 1024 * 1024
export const LOGO_SIZE_PX = 512
/** The page-1 preview rendered in the browser before upload. */
export const THUMB_WIDTH_PX = 1200
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024

export const INVITE_TTL_DAYS = 14

/** Exact rejection messages (plan §3.2 "PDF upload"), used by the browser pre-check and the server. */
export const DECK_MESSAGES = {
  notPdf: 'This file isn’t a readable PDF.',
  tooLarge: (bytes: number) => `This PDF is ${(bytes / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`,
  tooManyPages: (pages: number) => `This PDF has ${pages} pages. The limit is ${MAX_PDF_PAGES}.`,
  empty: 'This PDF has no pages.',
  interrupted: 'Upload interrupted.',
  consent: 'Confirm you have permission to share the photos in this document.',
}

export const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
] as const


export function reportReasonLabel(value: string) {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value
}

type SetupItem = { key: 'deck' | 'summary' | 'logo' | 'invite'; label: string; done: boolean; optional: boolean; href: string }

/** The /pitches setup checklist. It disappears once the required items are done. */
export function setupChecklist(team: { hasDeck: boolean; hasSummary: boolean; hasLogo: boolean; memberCount: number; pendingInvites: number }) {
  const items: SetupItem[] = [
    { key: 'deck', label: 'Upload your sponsorship deck', done: team.hasDeck, optional: false, href: '/team#deck' },
    { key: 'summary', label: 'Add a one-line summary', done: team.hasSummary, optional: false, href: '/team#profile' },
    { key: 'logo', label: 'Add your team logo', done: team.hasLogo, optional: false, href: '/team#profile' },
    { key: 'invite', label: 'Invite a co-coach', done: team.memberCount > 1 || team.pendingInvites > 0, optional: true, href: '/team#members' },
  ]
  const required = items.filter((i) => !i.optional)
  return {
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    complete: required.every((i) => i.done),
  }
}

export function teamLabel(team: { number: number; name: string }) {
  return `Team ${team.number} · ${team.name}`
}

/**
 * Where a team is, as one line. FTC runs worldwide, so this is free text the team writes itself
 * ("Austin, Texas, USA", "Kuala Lumpur, Malaysia") rather than a city/state pair that only makes
 * sense in the United States.
 */
export function placeLabel(team: { location?: string | null }) {
  return team.location?.trim() ?? ''
}

export const MAX_LOCATION_LENGTH = 120
export const MAX_INSTAGRAM_LENGTH = 30

/**
 * Accepts what people actually paste — "@exodiusftc", "exodiusftc",
 * "https://instagram.com/exodiusftc/", "www.instagram.com/exodiusftc?hl=en" — and stores the bare
 * handle. Returns null for empty input and undefined when it isn't an Instagram handle at all.
 */
export function normalizeInstagram(input: string): string | null | undefined {
  const raw = input.trim()
  if (!raw) return null
  let handle = raw
  const url = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  if (/^instagram\.com\//i.test(url)) handle = url.slice('instagram.com/'.length)
  handle = handle.split(/[/?#]/)[0] ?? ''
  handle = handle.replace(/^@/, '')
  // Instagram handles are letters, digits, periods and underscores, up to 30 characters.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return undefined
  return handle
}

export function instagramUrl(handle: string) {
  return `https://instagram.com/${handle}`
}
