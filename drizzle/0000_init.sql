CREATE TYPE "public"."ask_type" AS ENUM('none', 'amount', 'in_kind', 'open');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."ftc_record_source" AS ENUM('first', 'ftcscout');--> statement-breakpoint
CREATE TYPE "public"."invite_kind" AS ENUM('team', 'sponsor');--> statement-breakpoint
CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pitch_status" AS ENUM('draft', 'in_review', 'changes_requested', 'rejected', 'sent', 'matched', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('matched', 'manual', 'unchecked');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."sponsor_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."support_type" AS ENUM('funding', 'equipment', 'software', 'mentorship', 'other');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cron_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" smallint NOT NULL,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"resend_id" text,
	"dedupe_key" text,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_priority_range" CHECK ("email_outbox"."priority" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ftc_team_cache" (
	"number" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"state" text,
	"country" text,
	"source" "ftc_record_source" NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ftc_team_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "invite_kind" NOT NULL,
	"team_id" uuid,
	"sponsor_id" uuid,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_exactly_one_org" CHECK (("invites"."kind" = 'team' and "invites"."team_id" is not null and "invites"."sponsor_id" is null)
        or ("invites"."kind" = 'sponsor' and "invites"."sponsor_id" is not null and "invites"."team_id" is null))
);
--> statement-breakpoint
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"status" "pitch_status" DEFAULT 'draft' NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ask_type" "ask_type" DEFAULT 'none' NOT NULL,
	"ask_amount_cents" integer,
	"ask_note" text,
	"created_by" uuid,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"responded_by" uuid,
	"responded_at" timestamp with time zone,
	"decline_reason" text,
	"team_contact" jsonb,
	"sponsor_contact" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pitches_ask_amount_nonnegative" CHECK ("pitches"."ask_amount_cents" is null or "pitches"."ask_amount_cents" >= 0),
	CONSTRAINT "pitches_season_range" CHECK ("pitches"."season" between 2020 and 2100)
);
--> statement-breakpoint
ALTER TABLE "pitches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"reporter_user_id" uuid,
	"reporter_email" text,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sponsor_members" (
	"sponsor_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_members_sponsor_id_user_id_pk" PRIMARY KEY("sponsor_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "sponsor_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text NOT NULL,
	"logo_path" text,
	"city" text,
	"state" text,
	"region" text,
	"about" text,
	"support_types" "support_type"[] DEFAULT '{}'::support_type[] NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "sponsor_status" DEFAULT 'pending' NOT NULL,
	"status_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"applicant_title" text,
	"applicant_linkedin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsors_questions_max" CHECK (jsonb_array_length("sponsors"."questions") <= 10)
);
--> statement-breakpoint
ALTER TABLE "sponsors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_join_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"state" text,
	"country" text,
	"website" text,
	"summary" text,
	"logo_path" text,
	"pdf_path" text,
	"pdf_pages" smallint,
	"pdf_bytes" integer,
	"pdf_thumb_path" text,
	"pdf_updated_at" timestamp with time zone,
	"media_consent_at" timestamp with time zone,
	"record_status" "record_status" DEFAULT 'unchecked' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_number_positive" CHECK ("teams"."number" > 0),
	CONSTRAINT "teams_summary_length" CHECK ("teams"."summary" is null or char_length("teams"."summary") <= 160),
	CONSTRAINT "teams_pdf_pages_range" CHECK ("teams"."pdf_pages" is null or "teams"."pdf_pages" between 1 and 5),
	CONSTRAINT "teams_pdf_bytes_range" CHECK ("teams"."pdf_bytes" is null or "teams"."pdf_bytes" between 1 and 10485760)
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"phone" text,
	"job_title" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"accepted_terms_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_length" CHECK (char_length("users"."name") <= 120)
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_members" ADD CONSTRAINT "sponsor_members_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_members" ADD CONSTRAINT "sponsor_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "cron_runs_job_idx" ON "cron_runs" USING btree ("job","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_dedupe_key" ON "email_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "email_outbox_queue_idx" ON "email_outbox" USING btree ("status","priority","send_after");--> statement-breakpoint
CREATE INDEX "email_outbox_sent_at_idx" ON "email_outbox" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_outbox_resend_id_idx" ON "email_outbox" USING btree ("resend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invites_team_idx" ON "invites" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "invites_sponsor_idx" ON "invites" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "pitches_one_per_season_key" ON "pitches" USING btree ("team_id","sponsor_id","season") WHERE "pitches"."status" <> 'withdrawn';--> statement-breakpoint
CREATE INDEX "pitches_sponsor_status_idx" ON "pitches" USING btree ("sponsor_id","status");--> statement-breakpoint
CREATE INDEX "pitches_team_status_idx" ON "pitches" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "pitches_status_submitted_idx" ON "pitches" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_members_user_key" ON "sponsor_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sponsors_status_idx" ON "sponsors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sponsors_name_idx" ON "sponsors" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "team_join_requests_pending_key" ON "team_join_requests" USING btree ("team_id","user_id") WHERE "team_join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "team_join_requests_user_idx" ON "team_join_requests" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_user_key" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_number_key" ON "teams" USING btree ("number");--> statement-breakpoint
CREATE INDEX "teams_verified_at_idx" ON "teams" USING btree ("verified_at");--> statement-breakpoint
CREATE INDEX "teams_name_idx" ON "teams" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));