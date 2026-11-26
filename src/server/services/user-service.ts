import {
  localeSchema,
  type GetActorByAuthUserId,
  type GetActorBySlackUserId,
  type GetMyProfile,
  type SetMyLocale,
  type UpsertUserFromSlack,
} from "@/contracts";
import { getDb } from "@/server/db/client";
import {
  findActiveActorByAuthUserId,
  findActiveProfileBySlackUserId,
  findMyProfileById,
  updateUserLocale,
  upsertUserBySlackId,
} from "@/server/db/queries/users";
import { NotFoundError } from "./errors";
import { buildUserUpsert } from "./user-mapping";
import { parseInput } from "./validation";

/** Thrown when an archived (is_active = false) user signs in with Slack. */
export class InactiveUserError extends Error {
  constructor(public readonly userId: string) {
    super("User is archived");
    this.name = "InactiveUserError";
  }
}

/**
 * Contract UpsertUserFromSlack: match on `slack_user_id`, link `auth_user_id`, refresh
 * email/avatar/name, and overwrite timezone only when Slack sent one. New users are
 * `member`s. Archived users are not reactivated: the row is refreshed, then
 * InactiveUserError is thrown so the auth layer can refuse the session.
 */
export const upsertUserFromSlack: UpsertUserFromSlack = async (identity) => {
  const { insert, update } = buildUserUpsert(identity);
  const row = await upsertUserBySlackId(getDb(), insert, update);
  if (!row.isActive) throw new InactiveUserError(row.userId);
  return { userId: row.userId, role: row.role };
};

/** Contract GetActorBySlackUserId: active user's actor + Slack profile; null if unknown or archived. */
export const getActorBySlackUserId: GetActorBySlackUserId = async (slackUserId) => {
  if (slackUserId.trim() === "") return null;
  return (await findActiveProfileBySlackUserId(getDb(), slackUserId)) ?? null;
};

/** Contract GetActorByAuthUserId: the active Tempo user for a Supabase auth id, else null. */
export const getActorByAuthUserId: GetActorByAuthUserId = async (authUserId) => {
  return (await findActiveActorByAuthUserId(getDb(), authUserId)) ?? null;
};

/** Contract GetMyProfile (A12): the actor's own profile; no RBAC beyond "self". NotFoundError if the row is gone. */
export const getMyProfile: GetMyProfile = async (actor) => {
  const row = await findMyProfileById(getDb(), actor.userId);
  if (!row) throw new NotFoundError("User not found");
  return row;
};

/** Contract SetMyLocale (A14): the actor changes only their own language. NotFoundError if the row is gone. */
export const setMyLocale: SetMyLocale = async (actor, locale) => {
  const value = parseInput(localeSchema, locale);
  if (!(await updateUserLocale(getDb(), actor.userId, value))) throw new NotFoundError("User not found");
};
