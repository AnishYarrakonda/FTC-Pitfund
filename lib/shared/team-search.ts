/*
 * Find a team in the FIRST directory as the coach types: by number ("315" → 31579, 31580…), by
 * name ("exodus" → Exodius, a typo away), by the long registered name or the city. Pure and
 * client-safe; lib/server/ftc-directory.ts feeds it the rows. No model and no request.
 */

export type DirectoryTeam = {
  number: number
  name: string
  fullName: string | null
  city: string | null
  state: string | null
  country: string | null
}

export type IndexedTeam = DirectoryTeam & {
  numberText: string
  /** Normalized fields, tokenized once when the index is built. */
  nameNorm: string
  nameTokens: string[]
  otherTokens: string[]
}

const SEARCH_LIMIT = 6

const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const tokens = (value: string | null | undefined) => normalize(value).split(' ').filter(Boolean)

export function indexTeams(rows: DirectoryTeam[]): IndexedTeam[] {
  return rows.map((row) => ({
    ...row,
    numberText: String(row.number),
    nameNorm: normalize(row.name),
    nameTokens: tokens(row.name),
    otherTokens: [...tokens(row.fullName), ...tokens(row.city), ...tokens(row.state)],
  }))
}

/** Edit distance with insert, delete, substitute and swap, giving up once it passes `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prev2[j - 2] + 1)
      row.push(value)
      if (value < best) best = value
    }
    if (best > max) return max + 1
    prev2 = prev
    prev = row
  }
  return prev[b.length]
}

/** How well one query word matches one of a team's words: 0 = no match, higher = better. */
function wordScore(word: string, candidates: string[]): number {
  let best = 0
  for (const candidate of candidates) {
    if (candidate === word) return 10
    if (candidate.startsWith(word)) best = Math.max(best, 8)
    else if (word.length >= 3 && candidate.includes(word)) best = Math.max(best, 5)
    else if (word.length >= 4) {
      const allowed = word.length >= 8 ? 2 : 1
      // A typo may be in the middle of a word, or in what the coach hasn't finished typing.
      const d = Math.min(distance(word, candidate, allowed), distance(word, candidate.slice(0, word.length), allowed))
      if (d <= allowed) best = Math.max(best, 4 - d)
    }
  }
  return best
}

export function searchTeams(index: IndexedTeam[], query: string, limit = SEARCH_LIMIT): DirectoryTeam[] {
  const words = tokens(query)
  if (words.length === 0) return []

  const digits = words.filter((w) => /^\d+$/.test(w))
  const letters = words.filter((w) => !/^\d+$/.test(w))

  // A bare number: exact team first, then every number that starts with it, lowest first.
  if (letters.length === 0) {
    const wanted = digits[0]
    const matches = index.filter((t) => t.numberText.startsWith(wanted))
    matches.sort((a, b) => Number(b.numberText === wanted) - Number(a.numberText === wanted) || a.number - b.number)
    return matches.slice(0, limit).map(strip)
  }

  const scored: Array<{ team: IndexedTeam; score: number }> = []
  for (const team of index) {
    if (digits.length && !digits.every((d) => team.numberText.startsWith(d))) continue
    let score = 0
    let ok = true
    for (const word of letters) {
      const inName = wordScore(word, team.nameTokens)
      const elsewhere = inName ? 0 : wordScore(word, team.otherTokens) * 0.6
      const got = inName || elsewhere
      if (!got) {
        ok = false
        break
      }
      score += got
    }
    if (!ok) continue
    const joined = letters.join(' ')
    if (team.nameNorm === joined) score += 20
    else if (team.nameNorm.startsWith(joined)) score += 8
    scored.push({ team, score })
  }
  scored.sort((a, b) => b.score - a.score || a.team.number - b.team.number)
  return scored.slice(0, limit).map((s) => strip(s.team))
}

function strip(team: IndexedTeam): DirectoryTeam {
  return { number: team.number, name: team.name, fullName: team.fullName, city: team.city, state: team.state, country: team.country }
}
