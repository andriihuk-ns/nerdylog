-- Custom SQL migration: lock down Supabase Data API grants (Wave 3 QA audit).
-- Decision: Tempo has NO Supabase Data API (PostgREST) access by design. All data access is
-- server-side Drizzle (table owner) with service-layer RBAC (amendment A5). RLS from 0001/0004
-- stays as defence in depth.
-- Supabase grants ALL on public tables/sequences/functions to anon and authenticated by default.
-- That includes TRUNCATE (not subject to RLS), TRIGGER and REFERENCES. Revoke everything.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint

-- Future objects. Without FOR ROLE, ALTER DEFAULT PRIVILEGES changes only the defaults of the
-- role running this migration (the migrating role, `postgres` on Supabase). Objects created by
-- other roles (e.g. supabase_admin) keep that role's own defaults.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;--> statement-breakpoint

-- QA finding 4: projects / company_holidays were readable by any authenticated session
-- (USING (true)), including users with no row or an inactive row. Restrict to active app users:
-- app_private.current_user_id() returns NULL unless auth.uid() maps to an active users row.
DROP POLICY IF EXISTS "projects_select_authenticated" ON "projects";--> statement-breakpoint
CREATE POLICY "projects_select_active_user" ON "projects" FOR SELECT TO authenticated
  USING ((SELECT app_private.current_user_id()) IS NOT NULL);--> statement-breakpoint
DROP POLICY IF EXISTS "company_holidays_select_authenticated" ON "company_holidays";--> statement-breakpoint
CREATE POLICY "company_holidays_select_active_user" ON "company_holidays" FOR SELECT TO authenticated
  USING ((SELECT app_private.current_user_id()) IS NOT NULL);
