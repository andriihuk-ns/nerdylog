-- Custom SQL migration: Row-Level Security for app_settings (amendment A11).
-- Same style as 0001: reuses the app_private helpers; Drizzle (table owner) bypasses RLS
-- and services still enforce RBAC (A5). Managers/admins read, only admins write.

ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "app_settings_select_manager" ON "app_settings" FOR SELECT TO authenticated
  USING ((SELECT app_private.is_manager_or_admin()));--> statement-breakpoint
CREATE POLICY "app_settings_admin_write" ON "app_settings" FOR ALL TO authenticated
  USING ((SELECT app_private.is_admin())) WITH CHECK ((SELECT app_private.is_admin()));
