import type { DirectoryUser } from "@/contracts";
import { matchesQuery } from "@/components/lib/search";
import type { TeamFilters } from "./team-summary";

const MAX_QUERY = 100;

/** `?q=` and `?project=` → filters (project must be a known id; query trimmed and capped). */
export function parseTeamFilters(q: unknown, project: unknown, projectIds: readonly string[]): TeamFilters {
  const query = typeof q === "string" ? q.trim().slice(0, MAX_QUERY) : "";
  const id = typeof project === "string" && projectIds.includes(project) ? project : null;
  return { q: query, project: id };
}

/**
 * Which people the Team grid and the Standup drawer show. Search matches name, email and title;
 * the project filter keeps members (DirectoryUser.projectIds). Unknown users only match by name.
 */
export function visibleUserIds(
  people: readonly { userId: string; fullName: string }[],
  directory: readonly DirectoryUser[],
  f: TeamFilters,
): Set<string> {
  const byId = new Map(directory.map((u) => [u.id, u]));
  const out = new Set<string>();
  for (const p of people) {
    const u = byId.get(p.userId);
    if (!matchesQuery([p.fullName, u?.email, u?.title], f.q)) continue;
    if (f.project && !u?.projectIds.includes(f.project)) continue;
    out.add(p.userId);
  }
  return out;
}
