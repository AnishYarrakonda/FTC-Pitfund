import type { PitchStatus } from './types'

/*
 * How the sponsor directory is cut down for one team.
 *
 * Companies don't have "types" in any way a coach cares about — they are businesses that want their
 * name next to a robotics team, not organisations with sponsorship programmes. What a coach actually
 * wants to know, looking at a list of companies, is which ones they have already dealt with this
 * season. That is what these filters answer.
 */

export const PITCH_FILTERS = ['all', 'not_pitched', 'in_progress', 'pitched'] as const
export type PitchFilter = (typeof PITCH_FILTERS)[number]

export const PITCH_FILTER_LABEL: Record<PitchFilter, string> = {
  all: 'All',
  not_pitched: 'Not yet pitched',
  in_progress: 'In progress',
  pitched: 'Pitched',
}

/** A pitch you are still working on or waiting to hear about. */
const IN_PROGRESS: PitchStatus[] = ['draft', 'in_review', 'changes_requested', 'sent']

/**
 * A withdrawn pitch frees the slot (plan §1 rule 8), so it counts as "not yet pitched" — the coach
 * can start again. Everything else that reached a conclusion counts as pitched for this season.
 */
function filterOf(status: PitchStatus): Exclude<PitchFilter, 'all' | 'not_pitched'> | null {
  if (status === 'withdrawn') return null
  return IN_PROGRESS.includes(status) ? 'in_progress' : 'pitched'
}

type Statuses = Record<string, { id: string; status: PitchStatus } | undefined>

export function sponsorIdsFor(statuses: Statuses, kind: Exclude<PitchFilter, 'all'>): string[] {
  const ids: string[] = []
  for (const [sponsorId, pitch] of Object.entries(statuses)) {
    if (!pitch) continue
    const where = filterOf(pitch.status)
    if (!where) continue
    // "Not yet pitched" is an exclusion: every id the team has touched is removed from the full list.
    if (kind === 'not_pitched' || where === kind) ids.push(sponsorId)
  }
  return ids
}

export function pitchFilterCounts(statuses: Statuses, totalApproved: number): Record<PitchFilter, number> {
  let inProgress = 0
  let pitched = 0
  for (const pitch of Object.values(statuses)) {
    if (!pitch) continue
    const where = filterOf(pitch.status)
    if (where === 'in_progress') inProgress += 1
    else if (where === 'pitched') pitched += 1
  }
  return {
    all: totalApproved,
    not_pitched: Math.max(0, totalApproved - inProgress - pitched),
    in_progress: inProgress,
    pitched,
  }
}
