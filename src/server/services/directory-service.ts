import { z } from "zod";
import { roleSchema, type ListDirectory, type SyncDirectoryFromSlack, type UpdateDirectoryUser } from "@/contracts";
import { getDb } from "@/server/db/client";
import {
  findUsersBySlackIds,
  insertDirectoryUsers,
  listDirectoryUsers,
  updateDirectoryRow,
  updateUserProfileBySlackId,
} from "@/server/db/queries/directory";
import { planDirectorySync } from "./directory-sync";
import { InvalidInputError, NotFoundError } from "./errors";
import { assertAdmin, assertManagerOrAdmin } from "./rbac";
import { assertRowId, isValidTimeZone, parseInput } from "./validation";

/** Admin-editable fields. Ranges mirror numeric(3,1) / numeric(4,1) and the A9 check. */
export const directoryPatchSchema = z
  .strictObject({
    role: roleSchema,
    dailyNormHours: z.number().gt(0).max(24).multipleOf(0.1),
    ptoAllowanceDays: z.number().min(0).max(365).multipleOf(0.1).nullable(),
    isActive: z.boolean(),
    timezone: z.string().refine(isValidTimeZone, "Unknown IANA timezone"),
  })
  .partial();

/** Contract ListDirectory: manager/admin read, every user (archived included). */
export const listDirectory: ListDirectory = async (actor) => {
  assertManagerOrAdmin(actor);
  return listDirectoryUsers(getDb());
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
  const row = await updateDirectoryRow(getDb(), userId, parsed);
  if (!row) throw new NotFoundError("User not found");
  return row;
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
