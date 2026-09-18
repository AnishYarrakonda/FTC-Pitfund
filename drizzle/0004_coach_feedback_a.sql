CREATE TYPE "public"."org_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "subject_key" text;--> statement-breakpoint
ALTER TABLE "sponsor_members" ADD COLUMN "role" "org_role" DEFAULT 'editor' NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "role" "org_role" DEFAULT 'editor' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status" "org_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "proof_path" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "proof_bytes" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "proof_uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status_note" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Backfills. These run before the matching CHECK constraints and unique indexes below, so the
-- existing rows are already legal by the time those are added.

-- "Austin" + "TX" becomes the single line "Austin, TX". Truncated to the new 120-char limit.
UPDATE "teams" SET "location" = left(nullif(concat_ws(', ', "city", "state"), ''), 120);--> statement-breakpoint

-- Every team that already existed was live under the old model (teams entered the app immediately and
-- were verified afterwards), so they are grandfathered in as approved rather than being thrown back
-- into a review queue they never asked to join.
UPDATE "teams" SET
  "status" = CASE WHEN "suspended_at" IS NOT NULL THEN 'suspended'::"public"."org_status" ELSE 'approved'::"public"."org_status" END,
  "submitted_at" = "created_at",
  "decided_at" = COALESCE("verified_at", "created_at"),
  "decided_by" = "verified_by";--> statement-breakpoint

-- The longest-standing member of each org becomes its owner: under the old all-equal model the person
-- who created it is the earliest row, so this picks the founding coach.
UPDATE "team_members" tm SET "role" = 'owner'
WHERE tm."user_id" = (
  SELECT t2."user_id" FROM "team_members" t2
  WHERE t2."team_id" = tm."team_id"
  ORDER BY t2."created_at", t2."user_id"
  LIMIT 1
);--> statement-breakpoint
UPDATE "sponsor_members" sm SET "role" = 'owner'
WHERE sm."user_id" = (
  SELECT s2."user_id" FROM "sponsor_members" s2
  WHERE s2."sponsor_id" = sm."sponsor_id"
  ORDER BY s2."created_at", s2."user_id"
  LIMIT 1
);--> statement-breakpoint

CREATE INDEX "notifications_subject_idx" ON "notifications" USING btree ("subject_key") WHERE "notifications"."subject_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_members_owner_key" ON "sponsor_members" USING btree ("sponsor_id") WHERE "sponsor_members"."role" = 'owner';--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_owner_key" ON "team_members" USING btree ("team_id") WHERE "team_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "teams_status_idx" ON "teams" USING btree ("status");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_location_length" CHECK ("teams"."location" is null or char_length("teams"."location") <= 120);--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_instagram_length" CHECK ("teams"."instagram" is null or char_length("teams"."instagram") <= 30);--> statement-breakpoint

-- Trigram search for the sponsor directory. Exact-prefix matching is served by the existing
-- sponsors_name_idx; this GIN index backs similarity() so a misspelled company name still ranks.
-- Not expressible in schema.ts (drizzle has no operator-class support), so it lives only here.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "sponsors_name_trgm_idx" ON "sponsors" USING gin (lower("name") gin_trgm_ops);
