/** Shared by the server pages and the client tabs (must not live in a "use client" file). */
export const ADMIN_TABS = ["directory", "projects", "offices"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export const OFFICE_TABS = ["people", "holidays"] as const;
export type OfficeTab = (typeof OFFICE_TABS)[number];

/** Holidays moved inside each office (A37), so old `?tab=holidays` links open Offices. */
export function parseAdminTab(value: unknown): AdminTab {
  if (value === "holidays") return "offices";
  return ADMIN_TABS.includes(value as AdminTab) ? (value as AdminTab) : "directory";
}

export function parseOfficeTab(value: unknown): OfficeTab {
  return value === "holidays" ? "holidays" : "people";
}

export function adminHref(tab: AdminTab): string {
  return `/admin?tab=${tab}`;
}

/** `/admin/offices/{id}?tab=…&year=…` (year only when set). */
export function officeHref(officeId: string, tab: OfficeTab = "people", year?: number): string {
  const params = new URLSearchParams({ tab });
  if (year) params.set("year", String(year));
  return `/admin/offices/${officeId}?${params.toString()}`;
}
