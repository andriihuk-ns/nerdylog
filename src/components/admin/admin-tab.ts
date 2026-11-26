/** Shared by the server page and the client tabs (must not live in a "use client" file). */
export const ADMIN_TABS = ["directory", "teams", "projects", "holidays", "settings"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export function parseAdminTab(value: unknown): AdminTab {
  return ADMIN_TABS.includes(value as AdminTab) ? (value as AdminTab) : "directory";
}
