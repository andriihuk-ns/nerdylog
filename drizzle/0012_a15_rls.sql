-- Custom SQL migration: Row-Level Security and grants for offices / project_members (amendment A15).
-- Same model as slack_submissions / daily_pings (0001) and teams (0008): RLS on, no policies =
-- server-only access. Drizzle connects as the table owner (bypasses RLS); services enforce RBAC (A5).
-- 0005's ALTER DEFAULT PRIVILEGES only covers objects created by the migrating role, so revoke
-- Data API (PostgREST) access explicitly on the new tables as well.

ALTER TABLE "offices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON TABLE "offices" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "project_members" FROM anon, authenticated;
