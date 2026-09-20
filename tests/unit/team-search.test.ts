import { describe, expect, it } from 'vitest'

import { indexTeams, searchTeams, type DirectoryTeam } from '@/lib/shared/team-search'

const team = (number: number, name: string, city: string, fullName: string | null = null, state = 'CA'): DirectoryTeam => ({
  number,
  name,
  fullName,
  city,
  state,
  country: 'USA',
})

const INDEX = indexTeams([
  team(31579, 'Exodius', 'Fremont', 'Bin To Better'),
  team(31580, 'Exodus Robotics', 'Austin', null, 'TX'),
  team(3157, 'Cyber Wolves', 'San Jose'),
  team(315, 'Old Guard', 'Boise', null, 'ID'),
  team(23014, 'Robo Ravens', 'Boise', 'Raven Valley High School', 'ID'),
  team(8000, 'The Übermensch', 'Zürich', null, 'ZH'),
  team(12345, 'Team Unlimited', 'Sharon', 'FTC1 Team Unlimited 4-H Club', 'MA'),
])

const numbers = (query: string) => searchTeams(INDEX, query).map((t) => t.number)

describe('team finder search', () => {
  it('finds teams whose number starts with what was typed, exact first then lowest', () => {
    expect(numbers('315')).toEqual([315, 3157, 31579, 31580])
    expect(numbers('31579')).toEqual([31579])
    expect(numbers('999')).toEqual([])
  })

  it('finds a team by name, by a typo, and by the words it has left to type', () => {
    expect(numbers('exodius')[0]).toBe(31579)
    expect(numbers('exodus')[0]).toBe(31580)
    expect(numbers('exodis')).toContain(31579)
    expect(numbers('exod')).toEqual(expect.arrayContaining([31579, 31580]))
    expect(numbers('robo rav')).toEqual([23014])
    expect(numbers('cyber wolvs')).toEqual([3157])
  })

  it('searches the registered name and the city, and narrows by a number typed with the name', () => {
    expect(numbers('bin to better')).toEqual([31579])
    expect(numbers('raven valley')).toEqual([23014])
    expect(numbers('boise')).toEqual(expect.arrayContaining([315, 23014]))
    expect(numbers('exodius fremont')).toEqual([31579])
    expect(numbers('exod 3158')).toEqual([31580])
  })

  it('ignores case, accents and punctuation, and finds nothing for nothing', () => {
    expect(numbers('UBERMENSCH')).toEqual([8000])
    expect(numbers('team-unlimited')).toEqual([12345])
    expect(numbers('   ')).toEqual([])
    expect(numbers('qqqqqq')).toEqual([])
  })

  it('returns at most six suggestions', () => {
    const many = indexTeams(Array.from({ length: 40 }, (_, i) => team(5000 + i, `Robotics ${i}`, 'Austin')))
    expect(searchTeams(many, 'robotics')).toHaveLength(6)
    expect(searchTeams(many, '50')).toHaveLength(6)
  })
})
