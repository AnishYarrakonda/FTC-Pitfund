ALTER TABLE "teams" DROP CONSTRAINT "teams_verified_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "teams_verified_at_idx";--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "status" SET DATA TYPE "public"."org_status" USING "status"::text::"public"."org_status";--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "verified_at";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "verified_by";--> statement-breakpoint
DROP TYPE "public"."sponsor_status";