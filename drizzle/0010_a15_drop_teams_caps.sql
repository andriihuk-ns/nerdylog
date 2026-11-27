ALTER TABLE "team_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "team_members" CASCADE;--> statement-breakpoint
DROP TABLE "teams" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_code_unique";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "code";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "monthly_hour_cap";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "is_billable";