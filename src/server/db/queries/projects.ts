import { and, asc, eq, inArray } from "drizzle-orm";
import { STANDARD_MONTH_HOURS } from "@/contracts";
import { projectMembers, projects, timeEntries, users } from "../schema";
import type { DbOrTx } from "./types";

/** A15: cached Slack-channel membership rows. `projectIds` / `userIds` narrow; an empty list returns []. */
export async function listProjectMemberRows(
  db: DbOrTx,
  filter: { projectIds?: readonly string[]; userIds?: readonly string[] } = {},
): Promise<Array<{ projectId: string; userId: string; fullName: string; avatarUrl: string | null; allocationHoursPerMonth: number }>> {
  if (filter.projectIds?.length === 0 || filter.userIds?.length === 0) return [];
  const conditions = [];
  if (filter.projectIds) conditions.push(inArray(projectMembers.projectId, [...filter.projectIds]));
  if (filter.userIds) conditions.push(inArray(projectMembers.userId, [...filter.userIds]));
  return db
    .select({
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      allocationHoursPerMonth: projectMembers.allocationHoursPerMonth,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(projectMembers.projectId), asc(users.fullName), asc(users.id));
}

/** True when `userId` is a cached member of `projectId`. */
export async function isProjectMember(db: DbOrTx, userId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function projectExists(db: DbOrTx, projectId: string): Promise<boolean> {
  const rows = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  return rows.length > 0;
}

/** Tempo user ids for the given Slack ids (unknown ids are simply absent). */
export async function findUserIdsBySlackIds(db: DbOrTx, slackUserIds: readonly string[]): Promise<string[]> {
  if (slackUserIds.length === 0) return [];
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.slackUserId, [...slackUserIds]));
  return rows.map((r) => r.id);
}

/** Replaces a project's member set (call inside a transaction). */
export async function replaceProjectMemberRows(db: DbOrTx, projectId: string, userIds: readonly string[]): Promise<void> {
  const current = await db
    .select({ userId: projectMembers.userId, allocationHoursPerMonth: projectMembers.allocationHoursPerMonth })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
  const allocations = new Map(current.map((row) => [row.userId, row.allocationHoursPerMonth]));
  await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
  if (userIds.length === 0) return;
  await db
    .insert(projectMembers)
    .values(userIds.map((userId) => ({ projectId, userId, allocationHoursPerMonth: allocations.get(userId) ?? STANDARD_MONTH_HOURS })))
    .onConflictDoNothing();
}

/** Updates the monthly allocation for a member and returns their visible project membership. */
export async function updateProjectMemberAllocationRow(
  db: DbOrTx,
  projectId: string,
  userId: string,
  hoursPerMonth: number,
): Promise<{ userId: string; fullName: string; avatarUrl: string | null; allocationHoursPerMonth: number } | undefined> {
  const updated = await db
    .update(projectMembers)
    .set({ allocationHoursPerMonth: hoursPerMonth })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning({ userId: projectMembers.userId });
  if (updated.length === 0) return undefined;
  const [row] = await db
    .select({ userId: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl, allocationHoursPerMonth: projectMembers.allocationHoursPerMonth })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return row;
}

/** id → name for the given projects (all projects when `ids` is omitted). */
export async function listProjectNames(
  db: DbOrTx,
  ids?: readonly string[],
): Promise<Array<{ id: string; name: string }>> {
  if (ids?.length === 0) return [];
  const query = db.select({ id: projects.id, name: projects.name }).from(projects);
  return ids ? query.where(inArray(projects.id, [...ids])) : query;
}

/** A16: true when any time entry references the project (delete is then refused). */
export async function projectHasTimeEntries(db: DbOrTx, projectId: string): Promise<boolean> {
  const rows = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId))
    .limit(1);
  return rows.length > 0;
}

/** A16: deletes the project (project_members and project_prompts cascade). False when no row had `id`. */
export async function deleteProjectRow(db: DbOrTx, projectId: string): Promise<boolean> {
  const rows = await db.delete(projects).where(eq(projects.id, projectId)).returning({ id: projects.id });
  return rows.length > 0;
}
