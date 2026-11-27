import { z } from "zod";
import {
  roleSchema,
  type DirectoryUser,
  type ListDirectory,
  type SyncDirectoryFromSlack,
  type UpdateDirectoryUser,
} from "@/contracts";
import { getDb } from "@/server/db/client";
import {
  type DirectoryRow,
  findUsersBySlackIds,
  insertDirectoryUsers,
  listDirectoryUsers,
  updateDirectoryRow,
  updateUserProfileBySlackId,
} from "@/server/db/queries/directory";
import { officeExists } from "@/server/db/queries/offices";
import { listProjectMemberRows } from "@/server/db/queries/projects";
import type { DbOrTx } from "@/server/db/queries/types";
import { planDirectorySync } from "./directory-sync";
import { syncUserHolidayEntries } from "./holiday-entries";
import { InvalidInputError, NotFoundError } from "./errors";
import { assertAdmin, assertManagerOrAdmin } from "./rbac";
import { assertRowId, isValidTimeZone, parseInput } from "./validation";

/** Admin-editable fields. Ranges mirror numeric(3,1) / numeric(4,1) and the A9 check. */
export const directoryPatchSchema = z
  .strictObject({
    role: roleSchema,
    dailyNormHours: z.number().gt(0).max(24).multipleOf(0.1),
    ptoAllowanceDays: z.number().min(0).max(365).multipleOf(0.1).nullable(),
    sickAllowanceDays: z.number().min(0).max(365).multipleOf(0.1).nullable(),
    isActive: z.boolean(),
    timezone: z.string().refine(isValidTimeZone, "Unknown IANA timezone"),
    officeId: z.uuid("Unknown office").nullable(), // A15: null = no office (no holidays)
  })
  .partial();

/** A15: attach the projects whose channel each user is in. */
async function withProjectIds(db: DbOrTx, rows: DirectoryRow[]): Promise<DirectoryUser[]> {
  const members = await listProjectMemberRows(db, { userIds: rows.map((r) => r.id) });
  const byUser = new Map<string, string[]>();
  for (const m of members) byUser.set(m.userId, [...(byUser.get(m.userId) ?? []), m.projectId]);
  return rows.map((r) => ({ ...r, projectIds: byUser.get(r.id) ?? [] }));
}

/** Contract ListDirectory: manager/admin read, every user (archived included). */
export const listDirectory: ListDirectory = async (actor) => {
  assertManagerOrAdmin(actor);
  const db = getDb();
  return withProjectIds(db, await listDirectoryUsers(db));
};

/**
 * Contract UpdateDirectoryUser (admin only). An admin cannot demote or archive
 * themselves, so the workspace never loses its last way back into /admin by accident.
 */
export const updateDirectoryUser: UpdateDirectoryUser = async (actor, userId, patch) => {
  assertAdmin(actor);
  assertRowId(userId, "User");
  const parsed = parseInput(directoryPatchSchema, patch);
  if (userId === actor.userId) {
    if (parsed.role !== undefined && parsed.role !== "admin") {
      throw InvalidInputError.field("role", "You cannot remove your own admin role");
    }
    if (parsed.isActive === false) throw InvalidInputError.field("isActive", "You cannot archive yourself");
  }
  if (Object.keys(parsed).length === 0) throw InvalidInputError.field("_", "Nothing to update");
  const db = getDb();
  if (parsed.officeId && !(await officeExists(db, parsed.officeId))) {
    throw InvalidInputError.field("officeId", "Unknown office");
  }
  const row = await db.transaction(async (tx) => {
    const updated = await updateDirectoryRow(tx, userId, parsed);
    // Keep reactivation independent from holiday backfills so an optional calendar sync cannot
    // roll back the status change. Office changes for active users still refresh this/next year.
    if (updated?.isActive && parsed.officeId !== undefined) {
      const thisYear = new Date().getUTCFullYear();
      await syncUserHolidayEntries(tx, userId, updated.officeId, thisYear);
      await syncUserHolidayEntries(tx, userId, updated.officeId, thisYear + 1);
    }
    return updated;
  });
  if (!row) throw new NotFoundError("User not found");
  const [user] = await withProjectIds(db, [row]);
  return user;
};

/**
 * Contract SyncDirectoryFromSlack (admin only). One transaction: look up which Slack ids
 * exist, insert the new ones as active members, refresh profile fields of the rest.
 * `updated` counts existing rows that received at least one profile field.
 */
export const syncDirectoryFromSlack: SyncDirectoryFromSlack = async (actor, members) => {
  assertAdmin(actor);
  planDirectorySync(members, new Set()); // validate before opening a transaction
  return getDb().transaction(async (tx) => {
    const existing = await findUsersBySlackIds(
      tx,
      members.map((m) => m.slackUserId.trim()),
    );
    const plan = planDirectorySync(members, new Set(existing));
    const created = await insertDirectoryUsers(tx, plan.inserts);
    let updated = 0;
    for (const { slackUserId, set } of plan.updates) {
      if (Object.keys(set).length === 0) continue;
      if (await updateUserProfileBySlackId(tx, slackUserId, set)) updated++;
    }
    return { created, updated };
  });
};
