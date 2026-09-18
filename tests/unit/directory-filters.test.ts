import { describe, expect, it } from 'vitest'

import { pitchFilterCounts, sponsorIdsFor } from '@/lib/shared/directory'
import type { PitchStatus } from '@/lib/shared/types'

/*
 * Which companies a coach has already dealt with this season — the chips that replaced the
 * support-type filter. The rule that matters is the withdrawal one: withdrawing frees the slot
 * (plan §1 rule 8), so a withdrawn pitch has to read as "not yet pitched" or the coach is told they
 * can't pitch a company they can.
 */

const statuses = (entries: Array<[string, PitchStatus]>) => Object.fromEntries(entries.map(([id, status], i) => [id, { id: `p${i}`, status }]))

describe('directory filters', () => {
  it('counts a withdrawn pitch as not yet pitched, and everything else by where it stands', () => {
    const counts = pitchFilterCounts(
      statuses([
        ['a', 'draft'],
        ['b', 'in_review'],
        ['c', 'changes_requested'],
        ['d', 'sent'],
        ['e', 'matched'],
        ['f', 'declined'],
        ['g', 'rejected'],
        ['h', 'withdrawn'],
      ]),
      20,
    )
    expect(counts.in_progress).toBe(4)
    expect(counts.pitched).toBe(3)
    // 20 companies, 7 with a live pitch: the withdrawn one is still open to pitch again.
    expect(counts.not_pitched).toBe(13)
    expect(counts.all).toBe(20)
  })

  it('never reports a negative count when the pitch map is ahead of the total', () => {
    // The total is cached and the pitch map isn't, so they can disagree for a moment.
    const counts = pitchFilterCounts(statuses([['a', 'matched'], ['b', 'sent']]), 1)
    expect(counts.not_pitched).toBe(0)
  })

  it('turns the map into the ids each chip needs', () => {
    const map = statuses([
      ['a', 'draft'],
      ['b', 'matched'],
      ['c', 'withdrawn'],
    ])
    expect(sponsorIdsFor(map, 'in_progress')).toEqual(['a'])
    expect(sponsorIdsFor(map, 'pitched')).toEqual(['b'])
    // "Not yet pitched" is an exclusion list, and a withdrawn pitch isn't on it.
    expect(sponsorIdsFor(map, 'not_pitched').sort()).toEqual(['a', 'b'])
  })

  it('is empty for a team that has pitched nobody', () => {
    const counts = pitchFilterCounts({}, 9)
    expect(counts).toEqual({ all: 9, not_pitched: 9, in_progress: 0, pitched: 0 })
    expect(sponsorIdsFor({}, 'not_pitched')).toEqual([])
  })
})
