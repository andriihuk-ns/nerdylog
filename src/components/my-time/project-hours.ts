import type { ProjectHours } from "@/contracts";

/** A15 "This month by project": non-zero rows, most hours first, then by name; plus the total. */
export function summarizeProjectHours(items: readonly ProjectHours[], locale = "en"): { rows: ProjectHours[]; total: number } {
  const rows = items
    .filter((i) => i.hours > 0)
    .sort((a, b) => b.hours - a.hours || a.projectName.localeCompare(b.projectName, locale));
  const total = Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100;
  return { rows, total };
}
