/** Shared by the server page and the client tabs (must not live in a "use client" file). */
export const ADMIN_TABS = ["directory", "projects", "offices", "holidays", "settings"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export function parseAdminTab(value: unknown): AdminTab {
  return ADMIN_TABS.includes(value as AdminTab) ? (value as AdminTab) : "directory";
}

/** `/admin?tab=…&year=…&office=…` (office only when set). */
export function adminHref(tab: AdminTab, year: number, officeId?: string | null): string {
  const params = new URLSearchParams({ tab, year: String(year) });
  if (officeId) params.set("office", officeId);
  return `/admin?${params.toString()}`;
}
