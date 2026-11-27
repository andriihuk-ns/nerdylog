import type { DirectoryUser } from "@/contracts";
import { matchesQuery } from "@/components/lib/search";

/** Select sentinel values (Radix Select needs non-empty strings). */
export const ALL = "__all";
export const NONE = "__none";

export interface DirectoryFilters {
  query: string;
  projectId: string; // ALL or a project id
  officeId: string; // ALL, NONE or an office id
}

export const EMPTY_FILTERS: DirectoryFilters = { query: "", projectId: ALL, officeId: ALL };

/** A15 Directory: search name/email/title, then project and office filters. Active first, then by name. */
export function filterDirectory(users: readonly DirectoryUser[], f: DirectoryFilters): DirectoryUser[] {
  return users
    .filter((u) => matchesQuery([u.fullName, u.email, u.title], f.query))
    .filter((u) => f.projectId === ALL || u.projectIds.includes(f.projectId))
    .filter((u) => f.officeId === ALL || (f.officeId === NONE ? u.officeId === null : u.officeId === f.officeId))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName));
}

export function hasFilters(f: DirectoryFilters): boolean {
  return f.query.trim() !== "" || f.projectId !== ALL || f.officeId !== ALL;
}
