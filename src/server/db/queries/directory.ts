import { asc, desc, eq, inArray } from "drizzle-orm";
import type { DirectoryUser } from "@/contracts";
import { users, type UserInsert } from "../schema";
import type { DbOrTx } from "./types";

const directoryColumns = {
  id: users.id,
  slackUserId: users.slackUserId,
  fullName: users.fullName,
  email: users.email,
  avatarUrl: users.avatarUrl,
  role: users.role,
  timezone: users.timezone,
  dailyNormHours: users.dailyNormHours,
  ptoAllowanceDays: users.ptoAllowanceDays,
  isActive: users.isActive,
};

/** Every user (active first, then by name) for the admin Team Directory. */
export async function listDirectoryUsers(db: DbOrTx): Promise<DirectoryUser[]> {
  return db
    .select(directoryColumns)
    .from(users)
    .orderBy(desc(users.isActive), asc(users.fullName), asc(users.id));
}

export async function findDirectoryUser(db: DbOrTx, id: string): Promise<DirectoryUser | undefined> {
  const [row] = await db.select(directoryColumns).from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export type DirectoryPatch = Partial<
  Pick<UserInsert, "role" | "dailyNormHours" | "ptoAllowanceDays" | "isActive" | "timezone">
>;

/** Returns the updated row, or undefined when no such user. */
export async function updateDirectoryRow(
  db: DbOrTx,
  id: string,
  patch: DirectoryPatch,
): Promise<DirectoryUser | undefined> {
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning(directoryColumns);
  return row;
}

/** Existing users among the given Slack ids. */
export async function findUsersBySlackIds(db: DbOrTx, slackUserIds: readonly string[]): Promise<string[]> {
  if (slackUserIds.length === 0) return [];
  const rows = await db
    .select({ slackUserId: users.slackUserId })
    .from(users)
    .where(inArray(users.slackUserId, [...slackUserIds]));
  return rows.map((r) => r.slackUserId);
}

/** Inserts new users; rows that appeared concurrently are skipped. Returns how many were inserted. */
export async function insertDirectoryUsers(db: DbOrTx, rows: UserInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await db.insert(users).values(rows).onConflictDoNothing().returning({ id: users.id });
  return inserted.length;
}

/** Profile refresh for one Slack user. Returns true when a row matched. */
export async function updateUserProfileBySlackId(
  db: DbOrTx,
  slackUserId: string,
  set: Partial<Pick<UserInsert, "fullName" | "email" | "avatarUrl" | "timezone">>,
): Promise<boolean> {
  const rows = await db
    .update(users)
    .set(set)
    .where(eq(users.slackUserId, slackUserId))
    .returning({ id: users.id });
  return rows.length > 0;
}
