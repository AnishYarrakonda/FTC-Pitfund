import 'server-only'

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authUsers } from 'drizzle-orm/supabase'

import { ORG_ROLES, ORG_STATUSES, PITCH_STATUSES, SUPPORT_TYPES } from '@/lib/shared/types'

/*
 * The whole v2 schema (plan §4). Row-level security is enabled on every table with ZERO
 * policies, so the Supabase REST API exposes nothing to anon/authenticated. All access goes
 * through lib/server/data/* on the server, guarded by lib/server/authz.ts.
 *
 * Change this file, then `npm run db:generate` and `npm run db:migrate`. Never hand-edit SQL
 * in a production database.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
const ts = (name: string) => timestamp(name, { withTimezone: true })

// ─── Enums ──────────────────────────────────────────────────────────────────────────────

export const recordStatus = pgEnum('record_status', ['matched', 'manual', 'unchecked'])
export const joinRequestStatus = pgEnum('join_request_status', [
  'pending',
  'approved',
  'declined',
  'cancelled',
])
export const orgStatus = pgEnum('org_status', ORG_STATUSES)
export const orgRole = pgEnum('org_role', ORG_ROLES)
export const supportType = pgEnum('support_type', SUPPORT_TYPES)
export const inviteKind = pgEnum('invite_kind', ['team', 'sponsor'])
export const pitchStatus = pgEnum('pitch_status', PITCH_STATUSES)
export const askType = pgEnum('ask_type', ['none', 'amount', 'in_kind', 'open'])
export const emailStatus = pgEnum('email_status', ['queued', 'sending', 'sent', 'failed', 'bounced'])
export const reportStatus = pgEnum('report_status', ['open', 'resolved'])
export const ftcRecordSource = pgEnum('ftc_record_source', ['first', 'ftcscout'])

// ─── JSON shapes ────────────────────────────────────────────────────────────────────────

export type SponsorQuestion = { id: string; prompt: string; help?: string; required: boolean }
export type PitchAnswer = { questionId: string; prompt: string; answer: string }
/** Who to contact on a match, snapshotted when the company says it's interested. */
export type ContactSnapshot = {
  name: string
  email: string
  phone: string | null
  jobTitle?: string | null
  /** Team side: the public team page. */
  teamUrl?: string | null
  teamName?: string | null
  teamNumber?: number | null
  /** Company side. */
  companyName?: string | null
  website?: string | null
}

// ─── People ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    jobTitle: text('job_title'),
    isAdmin: boolean('is_admin').notNull().default(false),
    acceptedTermsAt: ts('accepted_terms_at'),
    suspendedAt: ts('suspended_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    check('users_name_length', sql`char_length(${t.name}) <= 120`),
  ],
).enableRLS()

// ─── Teams ──────────────────────────────────────────────────────────────────────────────

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull(),
    name: text('name').notNull(),
    /** One free-text line ("Austin, Texas, USA", "Kuala Lumpur, Malaysia"): FTC is not a US-only program. */
    location: text('location'),
    /** From the FIRST record, for admin review only. Never displayed; `location` is what people read. */
    country: text('country'),
    website: text('website'),
    /** Stored as a bare handle, without the leading "@". */
    instagram: text('instagram'),
    summary: text('summary'),
    logoPath: text('logo_path'),
    logoBytes: integer('logo_bytes'),
    pdfPath: text('pdf_path'),
    pdfPages: smallint('pdf_pages'),
    pdfBytes: integer('pdf_bytes'),
    pdfThumbPath: text('pdf_thumb_path'),
    pdfThumbBytes: integer('pdf_thumb_bytes'),
    pdfUpdatedAt: ts('pdf_updated_at'),
    mediaConsentAt: ts('media_consent_at'),
    recordStatus: recordStatus('record_status').notNull().default('unchecked'),
    /** The gate: only an `approved` team reaches the app. See lib/shared/types.ts. */
    status: orgStatus('status').notNull().default('draft'),
    /** Proof the person coaches this team (a FIRST Dashboard screenshot). Private bucket, admin eyes only. */
    proofPath: text('proof_path'),
    proofBytes: integer('proof_bytes'),
    proofUploadedAt: ts('proof_uploaded_at'),
    submittedAt: ts('submitted_at'),
    /** Why an admin rejected it, shown back to the coach. Mirrors sponsors.status_note. */
    statusNote: text('status_note'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: ts('decided_at'),
    suspendedAt: ts('suspended_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('teams_number_key').on(t.number),
    index('teams_status_idx').on(t.status),
    index('teams_name_idx').on(sql`lower(${t.name})`),
    check('teams_number_positive', sql`${t.number} > 0`),
    check('teams_summary_length', sql`${t.summary} is null or char_length(${t.summary}) <= 160`),
    check('teams_location_length', sql`${t.location} is null or char_length(${t.location}) <= 120`),
    check('teams_instagram_length', sql`${t.instagram} is null or char_length(${t.instagram}) <= 30`),
    check('teams_pdf_pages_range', sql`${t.pdfPages} is null or ${t.pdfPages} between 1 and 5`),
    check('teams_pdf_bytes_range', sql`${t.pdfBytes} is null or ${t.pdfBytes} between 1 and 10485760`),
  ],
).enableRLS()

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRole('role').notNull().default('editor'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    // One team per user.
    uniqueIndex('team_members_user_key').on(t.userId),
    // Exactly one owner per team, enforced here so no race can produce two or zero.
    uniqueIndex('team_members_owner_key')
      .on(t.teamId)
      .where(sql`${t.role} = 'owner'`),
  ],
).enableRLS()

export const teamJoinRequests = pgTable(
  'team_join_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: joinRequestStatus('status').notNull().default('pending'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: ts('decided_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('team_join_requests_pending_key')
      .on(t.teamId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    index('team_join_requests_user_idx').on(t.userId, t.status),
  ],
).enableRLS()

// ─── Sponsors ───────────────────────────────────────────────────────────────────────────

export const sponsors = pgTable(
  'sponsors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    website: text('website').notNull(),
    logoPath: text('logo_path'),
    logoBytes: integer('logo_bytes'),
    city: text('city'),
    state: text('state'),
    region: text('region'),
    about: text('about'),
    supportTypes: supportType('support_types').array().notNull().default(sql`'{}'::support_type[]`),
    questions: jsonb('questions').$type<SponsorQuestion[]>().notNull().default([]),
    status: orgStatus('status').notNull().default('draft'),
    statusNote: text('status_note'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: ts('decided_at'),
    submittedAt: ts('submitted_at'),
    applicantTitle: text('applicant_title'),
    applicantLinkedin: text('applicant_linkedin'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('sponsors_status_idx').on(t.status),
    index('sponsors_name_idx').on(sql`lower(${t.name})`),
    check('sponsors_questions_max', sql`jsonb_array_length(${t.questions}) <= 10`),
  ],
).enableRLS()

export const sponsorMembers = pgTable(
  'sponsor_members',
  {
    sponsorId: uuid('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRole('role').notNull().default('editor'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.sponsorId, t.userId] }),
    // One company per user.
    uniqueIndex('sponsor_members_user_key').on(t.userId),
    // Exactly one owner per company, enforced here so no race can produce two or zero.
    uniqueIndex('sponsor_members_owner_key')
      .on(t.sponsorId)
      .where(sql`${t.role} = 'owner'`),
  ],
).enableRLS()

// ─── Invites ────────────────────────────────────────────────────────────────────────────

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: inviteKind('kind').notNull(),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    sponsorId: uuid('sponsor_id').references(() => sponsors.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // SHA-256 of the 32-byte token. The token itself is never stored.
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: ts('expires_at').notNull(),
    acceptedAt: ts('accepted_at'),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('invites_token_hash_key').on(t.tokenHash),
    index('invites_team_idx').on(t.teamId),
    index('invites_sponsor_idx').on(t.sponsorId),
    check(
      'invites_exactly_one_org',
      sql`(${t.kind} = 'team' and ${t.teamId} is not null and ${t.sponsorId} is null)
        or (${t.kind} = 'sponsor' and ${t.sponsorId} is not null and ${t.teamId} is null)`,
    ),
  ],
).enableRLS()

// ─── Pitches ────────────────────────────────────────────────────────────────────────────

export const pitches = pgTable(
  'pitches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    sponsorId: uuid('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    // Start year of the Sept 1 → Aug 31 season (lib/shared/season.ts).
    season: integer('season').notNull(),
    status: pitchStatus('status').notNull().default('draft'),
    answers: jsonb('answers').$type<PitchAnswer[]>().notNull().default([]),
    askType: askType('ask_type').notNull().default('none'),
    askAmountCents: integer('ask_amount_cents'),
    askNote: text('ask_note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: ts('submitted_at'),
    reviewNote: text('review_note'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: ts('reviewed_at'),
    sentAt: ts('sent_at'),
    respondedBy: uuid('responded_by').references(() => users.id, { onDelete: 'set null' }),
    respondedAt: ts('responded_at'),
    declineReason: text('decline_reason'),
    teamContact: jsonb('team_contact').$type<ContactSnapshot>(),
    sponsorContact: jsonb('sponsor_contact').$type<ContactSnapshot>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One pitch per team per company per season. Withdrawing frees the slot.
    uniqueIndex('pitches_one_per_season_key')
      .on(t.teamId, t.sponsorId, t.season)
      .where(sql`${t.status} <> 'withdrawn'`),
    index('pitches_sponsor_status_idx').on(t.sponsorId, t.status),
    index('pitches_team_status_idx').on(t.teamId, t.status),
    index('pitches_status_submitted_idx').on(t.status, t.submittedAt),
    check('pitches_ask_amount_nonnegative', sql`${t.askAmountCents} is null or ${t.askAmountCents} >= 0`),
    check('pitches_season_range', sql`${t.season} between 2020 and 2100`),
  ],
).enableRLS()

// ─── Activity ───────────────────────────────────────────────────────────────────────────

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_events_entity_idx').on(t.entityType, t.entityId, t.createdAt)],
).enableRLS()

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    href: text('href'),
    /**
     * What this notification is *about* ("join:<id>", "pitch:<id>"). An action item is cleared when the
     * thing is handled — by anyone on the org, not just whoever happened to click the bell — so the
     * resolver matches on this rather than on the row id. Null for pure history.
     */
    subjectKey: text('subject_key'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt.desc()),
    index('notifications_subject_idx').on(t.subjectKey).where(sql`${t.subjectKey} is not null`),
  ],
).enableRLS()

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toEmail: text('to_email').notNull(),
    template: text('template').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    // 0 auth · 1 transactional · 2 admin instant · 3 digest
    priority: smallint('priority').notNull(),
    status: emailStatus('status').notNull().default('queued'),
    attempts: smallint('attempts').notNull().default(0),
    lastError: text('last_error'),
    resendId: text('resend_id'),
    dedupeKey: text('dedupe_key'),
    sendAfter: ts('send_after').notNull().defaultNow(),
    sentAt: ts('sent_at'),
    // An admin dismissed a failed or bounced email on the System page (it stays for the quota count).
    dismissedAt: ts('dismissed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('email_outbox_dedupe_key').on(t.dedupeKey),
    index('email_outbox_queue_idx').on(t.status, t.priority, t.sendAfter),
    index('email_outbox_sent_at_idx').on(t.sentAt),
    index('email_outbox_resend_id_idx').on(t.resendId),
    check('email_outbox_priority_range', sql`${t.priority} between 0 and 3`),
  ],
).enableRLS()

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    reporterUserId: uuid('reporter_user_id').references(() => users.id, { onDelete: 'set null' }),
    reporterEmail: text('reporter_email'),
    reason: text('reason').notNull(),
    details: text('details'),
    status: reportStatus('status').notNull().default('open'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: ts('resolved_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
).enableRLS()

export const ftcTeamCache = pgTable('ftc_team_cache', {
  number: integer('number').primaryKey(),
  name: text('name').notNull(),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  source: ftcRecordSource('source').notNull(),
  fetchedAt: ts('fetched_at').notNull().defaultNow(),
  createdAt: createdAt(),
}).enableRLS()

export const cronRuns = pgTable(
  'cron_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    job: text('job').notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
    ok: boolean('ok'),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('cron_runs_job_idx').on(t.job, t.startedAt.desc())],
).enableRLS()

export type User = typeof users.$inferSelect
export type Team = typeof teams.$inferSelect
export type Sponsor = typeof sponsors.$inferSelect
export type Pitch = typeof pitches.$inferSelect
export type Invite = typeof invites.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type EmailOutboxRow = typeof emailOutbox.$inferSelect
export type PitchStatus = (typeof pitchStatus.enumValues)[number]
export type OrgStatus = (typeof orgStatus.enumValues)[number]
export type OrgRole = (typeof orgRole.enumValues)[number]
