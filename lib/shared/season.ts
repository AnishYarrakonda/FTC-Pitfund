/*
 * Two different "seasons" exist; do not conflate them.
 *
 * - pitchSeason: FTC Pitfund's own rule, one pitch per team per company per season, which
 *   runs Sept 1 → Aug 31. Stored as the start year (2026 = "2026–27").
 * - firstApiSeason: the FIRST Events API `{season}` path parameter, which rolls over in May.
 */

export function pitchSeason(date: Date = new Date()): number {
  const month = date.getUTCMonth() + 1
  return month >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1
}

export function seasonLabel(season: number): string {
  return `${season}–${String((season + 1) % 100).padStart(2, '0')}`
}

export function firstApiSeason(date: Date = new Date()): number {
  const month = date.getUTCMonth() + 1
  return month >= 5 ? date.getUTCFullYear() : date.getUTCFullYear() - 1
}
