-- Custom SQL migration: Row-Level Security (defence in depth, PRD §4.2 + amendment A5).
-- Target: Supabase Postgres (needs auth.uid() and the "authenticated" role).
-- Drizzle connects as the table owner and bypasses RLS; services still enforce RBAC (A5).
-- Mapping: auth.uid() -> users.auth_user_id -> users.id. Inactive users get no access.

CREATE SCHEMA IF NOT EXISTS app_private;--> statement-breakpoint
REVOKE ALL ON SCHEMA app_private FROM public;--> statement-breakpoint
GRANT USAGE ON SCHEMA app_private TO authenticated;--> statement-breakpoint

-- SECURITY DEFINER helpers read users without recursing into users' own RLS policies.
CREATE OR REPLACE FUNCTION app_private.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.is_active
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.current_user_role() RETURNS public.role
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.role FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.is_active
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.is_manager_or_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(app_private.current_user_role() IN ('manager', 'admin'), false)
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(app_private.current_user_role() = 'admin', false)
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.current_user_id(), app_private.current_user_role(),
  app_private.is_manager_or_admin(), app_private.is_admin() FROM public;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.current_user_id(), app_private.current_user_role(),
  app_private.is_manager_or_admin(), app_private.is_admin() TO authenticated;--> statement-breakpoint

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_holidays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- slack_submissions and daily_pings: RLS on, no policies = server (owner/service_role) only.
ALTER TABLE "slack_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_pings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- users: own row, or managers/admins see everyone. Only admins write.
CREATE POLICY "users_select_own_or_manager" ON "users" FOR SELECT TO authenticated
  USING (id = (SELECT app_private.current_user_id()) OR (SELECT app_private.is_manager_or_admin()));--> statement-breakpoint
CREATE POLICY "users_admin_write" ON "users" FOR ALL TO authenticated
  USING ((SELECT app_private.is_admin())) WITH CHECK ((SELECT app_private.is_admin()));--> statement-breakpoint

-- projects / company_holidays: readable by every authenticated user, written by admins.
CREATE POLICY "projects_select_authenticated" ON "projects" FOR SELECT TO authenticated
  USING (true);--> statement-breakpoint
CREATE POLICY "projects_admin_write" ON "projects" FOR ALL TO authenticated
  USING ((SELECT app_private.is_admin())) WITH CHECK ((SELECT app_private.is_admin()));--> statement-breakpoint
CREATE POLICY "company_holidays_select_authenticated" ON "company_holidays" FOR SELECT TO authenticated
  USING (true);--> statement-breakpoint
CREATE POLICY "company_holidays_admin_write" ON "company_holidays" FOR ALL TO authenticated
  USING ((SELECT app_private.is_admin())) WITH CHECK ((SELECT app_private.is_admin()));--> statement-breakpoint

-- time_entries (Stream A): members own rows; managers/admins read and write all (PRD §2).
CREATE POLICY "time_entries_select" ON "time_entries" FOR SELECT TO authenticated
  USING (user_id = (SELECT app_private.current_user_id()) OR (SELECT app_private.is_manager_or_admin()));--> statement-breakpoint
CREATE POLICY "time_entries_insert" ON "time_entries" FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT app_private.current_user_id()) OR (SELECT app_private.is_manager_or_admin()));--> statement-breakpoint
CREATE POLICY "time_entries_update" ON "time_entries" FOR UPDATE TO authenticated
  USING (user_id = (SELECT app_private.current_user_id()) OR (SELECT app_private.is_manager_or_admin()))
  WITH CHECK (user_id = (SELECT app_private.current_user_id()) OR (SELECT app_private.is_manager_or_admin()));--> statement-breakpoint
CREATE POLICY "time_entries_delete" ON "time_entries" FOR DELETE TO authenticated
  USING (user_id = (SELECT app_private.current_user_id()) OR (SELECT app_private.is_manager_or_admin()));--> statement-breakpoint

-- daily_checkins (Stream B): members own rows; managers/admins read all, write none.
CREATE POLICY "daily_checkins_select" ON "daily_checkins" FOR SELECT TO authenticated
  USING (user_id = (SELECT app_private.current_user_id()) OR (SELECT app_private.is_manager_or_admin()));--> statement-breakpoint
CREATE POLICY "daily_checkins_insert_own" ON "daily_checkins" FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT app_private.current_user_id()));--> statement-breakpoint
CREATE POLICY "daily_checkins_update_own" ON "daily_checkins" FOR UPDATE TO authenticated
  USING (user_id = (SELECT app_private.current_user_id()))
  WITH CHECK (user_id = (SELECT app_private.current_user_id()));--> statement-breakpoint
CREATE POLICY "daily_checkins_delete_own" ON "daily_checkins" FOR DELETE TO authenticated
  USING (user_id = (SELECT app_private.current_user_id()));
