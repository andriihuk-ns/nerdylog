import { and, asc, eq } from "drizzle-orm";
import type { Actor, Locale, MyProfile, SlackActorProfile } from "@/contracts";
import { users, type UserInsert } from "../schema";
import type { DbOrTx } from "./types";

export interface UserAccessRow extends Actor {
  isActive: boolean;
}

/** Insert or update a user keyed on `slack_user_id`; returns the RBAC fields. */
export async function upsertUserBySlackId(
  db: DbOrTx,
  insert: UserInsert,
  update: Partial<UserInsert>,
): Promise<UserAccessRow> {
  const [row] = await db
    .insert(users)
    .values(insert)
    .onConflictDoUpdate({ target: users.slackUserId, set: update })
    .returning({ userId: users.id, role: users.role, isActive: users.isActive });
  return row;
}

/** Active user linked to a Supabase auth id, or undefined. */
export async function findActiveActorByAuthUserId(db: DbOrTx, authUserId: string): Promise<Actor | undefined> {
  const [row] = await db
    .select({ userId: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.authUserId, authUserId), eq(users.isActive, true)))
    .limit(1);
  return row;
}

/** Active user by Slack id with the profile fields the Slack layer needs, or undefined. */
export async function findActiveProfileBySlackUserId(
  db: DbOrTx,
  slackUserId: string,
): Promise<SlackActorProfile | undefined> {
  const [row] = await db
    .select({
      userId: users.id,
      role: users.role,
      slackUserId: users.slackUserId,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
      locale: users.locale,
    })
    .from(users)
    .where(and(eq(users.slackUserId, slackUserId), eq(users.isActive, true)))
    .limit(1);
  return row;
}

/** A12: a user's own profile by id (archived users included), or undefined. */
export async function findMyProfileById(db: DbOrTx, userId: string): Promise<MyProfile | undefined> {
  const [row] = await db
    .select({
      userId: users.id,
      role: users.role,
      fullName: users.fullName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      title: users.title,
      timezone: users.timezone,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/** A14: set a user's language; returns false if no such user. */
export async function updateUserLocale(db: DbOrTx, userId: string, locale: Locale): Promise<boolean> {
  const rows = await db.update(users).set({ locale }).where(eq(users.id, userId)).returning({ id: users.id });
  return rows.length > 0;
}

export interface RollupUserRow {
  id: string;
  fullName: string;
  dailyNormHours: number;
}

/** Active users for rollups, sorted by name. `onlyUserId` narrows to one row (member scope). */
export async function listActiveRollupUsers(db: DbOrTx, onlyUserId?: string): Promise<RollupUserRow[]> {
  const active = eq(users.isActive, true);
  return db
    .select({ id: users.id, fullName: users.fullName, dailyNormHours: users.dailyNormHours })
    .from(users)
    .where(onlyUserId ? and(active, eq(users.id, onlyUserId)) : active)
    .orderBy(asc(users.fullName), asc(users.id));
}

/** Yearly vacation and sick allowances (null = not set), or undefined if no such user. */
export async function findPtoAllowance(
  db: DbOrTx,
  userId: string,
): Promise<{ allowanceDays: number | null; sickAllowanceDays: number | null } | undefined> {
  const [row] = await db
    .select({ allowanceDays: users.ptoAllowanceDays, sickAllowanceDays: users.sickAllowanceDays })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}
