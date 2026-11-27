-- Custom SQL migration: Row-Level Security and grants for project_prompts (amendment A16).
-- Same model as slack_submissions / daily_pings (0001) and offices / project_members (0012): RLS on,
-- no policies = server-only access. Drizzle connects as the table owner (bypasses RLS); the cron
-- service is the only writer. 0005's ALTER DEFAULT PRIVILEGES only covers objects created by the
-- migrating role, so revoke Data API (PostgREST) access explicitly as well.

ALTER TABLE "project_prompts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON TABLE "project_prompts" FROM anon, authenticated;
