CREATE TYPE "public"."entry_source" AS ENUM('slack_standup', 'slack_command', 'web_ui', 'sheet_import');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('work', 'vacation', 'sick', 'holiday');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."slack_submission_kind" AS ENUM('standup', 'log', 'pto');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slack_user_id" text NOT NULL,
	"auth_user_id" uuid,
	"full_name" text DEFAULT '' NOT NULL,
	"email" text,
	"avatar_url" text,
	"role" "role" DEFAULT 'member' NOT NULL,
	"timezone" text DEFAULT 'Europe/Kyiv' NOT NULL,
	"daily_norm_hours" numeric(3, 1) DEFAULT 8 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_slack_user_id_unique" UNIQUE("slack_user_id"),
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"monthly_hour_cap" numeric(5, 1),
	"is_billable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"work_date" date NOT NULL,
	"hours" numeric(4, 2) NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"task_summary" text DEFAULT '' NOT NULL,
	"ticket_refs" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" "entry_source" NOT NULL,
	"slack_view_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_hours_range" CHECK ("time_entries"."hours" >= 0 and "time_entries"."hours" <= 24),
	CONSTRAINT "time_entries_work_has_project" CHECK ("time_entries"."entry_type" <> 'work' or "time_entries"."project_id" is not null),
	CONSTRAINT "time_entries_pto_zero_hours" CHECK ("time_entries"."entry_type" = 'work' or "time_entries"."hours" = 0)
);
--> statement-breakpoint
CREATE TABLE "daily_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"checkin_date" date NOT NULL,
	"planned_today" text DEFAULT '' NOT NULL,
	"blockers" text DEFAULT '' NOT NULL,
	"channel_message_ts" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holiday_date" date NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "company_holidays_holiday_date_unique" UNIQUE("holiday_date")
);
--> statement-breakpoint
CREATE TABLE "slack_submissions" (
	"view_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "slack_submission_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_pings" (
	"user_id" uuid NOT NULL,
	"ping_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_pings_pk" PRIMARY KEY("user_id","ping_date")
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_submissions" ADD CONSTRAINT "slack_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_pings" ADD CONSTRAINT "daily_pings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_entries_user_date_idx" ON "time_entries" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_project_date_idx" ON "time_entries" USING btree ("project_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_slack_view_id_idx" ON "time_entries" USING btree ("slack_view_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checkins_user_date_uq" ON "daily_checkins" USING btree ("user_id","checkin_date");