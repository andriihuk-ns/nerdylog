-- Custom SQL migration: Row-Level Security and grants for teams / team_members (amendment A13).
-- Same model as slack_submissions / daily_pings in 0001: RLS on, no policies = server-only access.
-- Drizzle connects as the table owner (bypasses RLS) and services enforce RBAC (A5).
-- 0005 removed Data API (PostgREST) access; its ALTER DEFAULT PRIVILEGES only covers objects
-- created by the migrating role, so revoke explicitly on the new tables as well.

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON TABLE "teams" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "team_members" FROM anon, authenticated;
