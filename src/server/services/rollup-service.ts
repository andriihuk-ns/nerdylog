import type { Actor, GetProjectHours, GetTeamMonthRollup } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listProjectMemberRows, listProjectNames } from "@/server/db/queries/projects";
import { listEntriesInRange } from "@/server/db/queries/time-entries";
import { listActiveRollupUsers } from "@/server/db/queries/users";
import { monthRange } from "./calendar";
import { assertCanActOnUser } from "./rbac";
import { aggregateMonth, projectHours } from "./time-aggregator";
import { isRowId } from "./validation";

/** Amendment A5: managers and admins see the whole team; members see themselves. */
export function canViewTeam(actor: Actor): boolean {
  return actor.role === "manager" || actor.role === "admin";
}

/**
 * Contract GetTeamMonthRollup. Without a project filter, member → self and manager/admin → active
 * users. Project reports narrow that set to active project members and contributors.
 */
export const getTeamMonthRollup: GetTeamMonthRollup = async (actor, month, projectIds) => {
  const { start, end } = monthRange(month);
  const db = getDb();
  const users = await listActiveRollupUsers(db, canViewTeam(actor) ? undefined : actor.userId);
  const entries = await listEntriesInRange(db, { start, end, userIds: users.map((u) => u.id), projectIds });
  if (!projectIds) return aggregateMonth(month, users, entries);

  const projectMembers = await listProjectMemberRows(db, { projectIds });
  const projectUserIds = new Set([...projectMembers.map((member) => member.userId), ...entries.map((entry) => entry.userId)]);
  const includedUsers = users.filter((user) => projectUserIds.has(user.id));
  if (includedUsers.length === 0) return aggregateMonth(month, includedUsers, []);

  const contextEntries = await listEntriesInRange(db, {
    start,
    end,
    userIds: includedUsers.map((user) => user.id),
  });
  const reportEntries = contextEntries.filter(
    (entry) => entry.entryType !== "work" || (entry.projectId !== null && projectIds.includes(entry.projectId)),
  );
  return aggregateMonth(month, includedUsers, reportEntries);
};

/**
 * Contract GetProjectHours (A15, replaces cap usage). One user's `work` hours per project in the
 * month (default: the actor). member → only themselves (ForbiddenError otherwise); manager/admin →
 * anyone. Projects with no hours are omitted; sorted by name.
 */
export const getProjectHours: GetProjectHours = async (actor, month, userId = actor.userId) => {
  const { start, end } = monthRange(month);
  assertCanActOnUser(actor, userId);
  if (!isRowId(userId)) return [];
  const db = getDb();
  const entries = await listEntriesInRange(db, { start, end, userIds: [userId] });
  const ids = [...new Set(entries.flatMap((e) => (e.entryType === "work" && e.projectId ? [e.projectId] : [])))];
  return projectHours(month, await listProjectNames(db, ids), entries);
};
