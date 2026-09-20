import { createHash } from 'node:crypto'

/*
 * Deterministic ids for seeded rows, so E2E tests and the QA route list can address
 * `/t/31579`, `/sponsors/{id}` or `/pitches/{id}` without querying the database.
 * Pure (no server imports): tests import it directly.
 */

export function seedUuid(kind: string, key: string | number) {
  const hex = createHash('sha256').update(`pitfund-seed:${kind}:${key}`).digest('hex')
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export const seedTeamId = (number: number) => seedUuid('team', number)
export const seedSponsorId = (name: string) => seedUuid('sponsor', name)
export const seedPitchId = (teamNumber: number, sponsorName: string) => seedUuid('pitch', `${teamNumber}:${sponsorName}`)

/** Raw invite tokens seeded in `demo` and `edge` (only their SHA-256 is stored). */
export const SEED_INVITE_TOKENS = {
  /** Team Exodius → coach-new@pitfund.test, open for 10 more days. */
  valid: 'seed-invite-valid-exodius-coach-new',
  /** Team Exodius → old.invite@pitfund.test, expired 2 days ago. */
  expired: 'seed-invite-expired-exodius',
  /** Team Exodius → revoked.invite@pitfund.test, revoked yesterday. */
  revoked: 'seed-invite-revoked-exodius',
  /** Ribosome Robotics → member-ribosome@pitfund.test, accepted. */
  used: 'seed-invite-used-ribosome',
  /** Ribosome Robotics → finance@pitfund.test (no account yet), open. */
  sponsorValid: 'seed-invite-valid-ribosome-finance',
} as const

/** Named seeded rows the tests and QA routes use. */
export const SEED = {
  exodius: { number: 31579, id: seedTeamId(31579) },
  voltage: { number: 24890, id: seedTeamId(24890) },
  tidal: { number: 14398, id: seedTeamId(14398) },
  /** Suspended in `edge` only. */
  ironLotus: { number: 20443, id: seedTeamId(20443) },
  ribosome: seedSponsorId('Ribosome Robotics'),
  meridian: seedSponsorId('Mitochondria Machine Works'),
  lakeshore: seedSponsorId('Lysosome Medical Devices'),
  summit: seedSponsorId('Synapse Fabrication'),
  northpeak: seedSponsorId('NeuroPeak Software'),
  keystone: seedSponsorId('BioBuzz Foundation'),
  atlasPending: seedSponsorId('Allele Components'),
  greenfieldPending: seedSponsorId('Genome Analytics'),
  quickcashRejected: seedSponsorId('QuickClone Promotions'),
  vantageSuspended: seedSponsorId('Vacuole Promotions'),
  cedar: seedSponsorId('Nucleotide Credit Union'),
  harbor: seedSponsorId('Plasmid Point Energy'),
  reports: {
    /** Open: Tidal Robotics, from a parent. */
    tidal: seedUuid('report', 'tidal'),
    /** Open: Quantum Quokkas, from the sponsor persona. */
    quokkas: seedUuid('report', 'quokkas'),
  },
  pitches: {
    exodiusMatched: seedPitchId(31579, 'Ribosome Robotics'),
    exodiusSent: seedPitchId(31579, 'Nucleotide Credit Union'),
    exodiusInReview: seedPitchId(31579, 'Mitochondria Machine Works'),
    exodiusChanges: seedPitchId(31579, 'NeuroPeak Software'),
    exodiusRejected: seedPitchId(31579, 'Plasmid Point Energy'),
    exodiusDeclined: seedPitchId(31579, 'Telomere Aerospace'),
    /** Partial answers, and Summit changed its questions after the draft started. */
    exodiusDraft: seedPitchId(31579, 'Synapse Fabrication'),
    exodiusWithdrawn: seedPitchId(31579, 'Lysosome Medical Devices'),
    /** Voltage Vultures (coach2) draft: another team's draft. */
    voltageDraft: seedPitchId(24890, 'NeuroPeak Software'),
    // The `sponsor` persona's inbox (Ribosome Robotics).
    voltageToRibosomeSent: seedPitchId(24890, 'Ribosome Robotics'),
    quokkasToRibosomeSent: seedPitchId(18215, 'Ribosome Robotics'),
    gearToRibosomeDeclined: seedPitchId(16072, 'Ribosome Robotics'),
    lotusToRibosomeInReview: seedPitchId(20443, 'Ribosome Robotics'),
    /** In review, submitted a few hours ago (not late). */
    tidalToHarborInReview: seedPitchId(14398, 'Plasmid Point Energy'),
    /** In review to a suspended company: approval is blocked. */
    sagesToVantageInReview: seedPitchId(19904, 'Vacuole Promotions'),
    /** `sponsor2`'s inbox (Cedar Valley): sent. */
    exodiusToCedarSent: seedPitchId(31579, 'Nucleotide Credit Union'),
    /** Sent to Ribosome, then withdrawn (the company sees a read-only notice). */
    knightsToRibosomeWithdrawn: seedPitchId(22761, 'Ribosome Robotics'),
  },
} as const
