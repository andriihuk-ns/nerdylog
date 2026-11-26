import type { Actor, GetProjectCapUsage, GetTeamMonthRollup } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listCapProjects } from "@/server/db/queries/projects";
import { listEntriesInRange, listUserWorkProjectIds } from "@/server/db/queries/time-entries";
import { listActiveRollupUsers } from "@/server/db/queries/users";
import { monthRange } from "./calendar";
import { aggregateMonth, projectCapUsage } from "./time-aggregator";

/** Amendment A5: managers and admins see the whole team; members see themselves. */
export function canViewTeam(actor: Actor): boolean {
  return actor.role === "manager" || actor.role === "admin";
}

/**
 * Contract GetTeamMonthRollup. member → only their own row (empty if inactive);
 * manager/admin → every active user, sorted by name. Math lives in time-aggregator.
 */
export const getTeamMonthRollup: GetTeamMonthRollup = async (actor, month) => {
  const { start, end } = monthRange(month);
  const db = getDb();
  const users = await listActiveRollupUsers(db, canViewTeam(actor) ? undefined : actor.userId);
  const entries = await listEntriesInRange(db, { start, end, userIds: users.map((u) => u.id) });
  return aggregateMonth(month, users, entries);
};

/**
 * Contract GetProjectCapUsage. A client cap is a team-wide budget, so `usedHours` is
 * always the whole team's work on the project (archived users included).
 * manager/admin → every active project plus inactive ones with hours this month;
 * member → only projects they logged work on this month (no per-user breakdown).
 */
export const getProjectCapUsage: GetProjectCapUsage = async (actor, month) => {
  const { start, end } = monthRange(month);
  const db = getDb();
  const projectIds = canViewTeam(actor) ? undefined : await listUserWorkProjectIds(db, actor.userId, start, end);
  const projects = await listCapProjects(db, projectIds);
  const entries = await listEntriesInRange(db, { start, end, projectIds: projects.map((p) => p.id) });
  return projectCapUsage(month, projects, entries);
};
