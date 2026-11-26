import type { GetActorByAuthUserId, GetActorBySlackUserId, UpsertUserFromSlack } from "@/contracts";
import { getDb } from "@/server/db/client";
import {
  findActiveActorByAuthUserId,
  findActiveProfileBySlackUserId,
  upsertUserBySlackId,
} from "@/server/db/queries/users";
import { buildUserUpsert } from "./user-mapping";

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
