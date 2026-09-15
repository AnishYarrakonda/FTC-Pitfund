import 'server-only'

/*
 * Cache tags for `'use cache'` data (plan §5 "Caching and freshness"). Actions invalidate with
 * updateTag (read-your-own-writes) or revalidateTag(tag, 'max'); /api/revalidate expires the
 * collection tags after a reseed.
 */
export const TAGS = {
  /** Every public team page. */
  teams: 'teams',
  team: (id: string) => `team:${id}`,
  /** A team number, including one with no team yet (a cached 404). */
  teamNumber: (number: number) => `team-number:${number}`,
  /** The coach-facing sponsor directory and every company profile in it. */
  sponsors: 'sponsors',
  sponsor: (id: string) => `sponsor:${id}`,
}
