CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "slack_channel_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_slack_channel_id_unique" UNIQUE("slack_channel_id");