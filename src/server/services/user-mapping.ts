import { slackIdentitySchema, type SlackIdentity } from "@/contracts";
import type { UserInsert } from "@/server/db/schema";

/**
 * Pure mapping for UpsertUserFromSlack. New users get role `member` (DB default);
 * an existing row keeps its role, norm and active flag. `timezone` is written only
 * when Slack sent one, so a null never wipes a stored timezone. `title` (A12) follows the
 * same rule: written trimmed when non-blank; null or blank keeps the stored title.
 */
export function buildUserUpsert(identity: SlackIdentity): {
  insert: UserInsert;
  update: Partial<UserInsert>;
} {
  const id = slackIdentitySchema.parse(identity);
  const update: Partial<UserInsert> = {
    authUserId: id.authUserId,
    email: id.email,
    avatarUrl: id.avatarUrl,
    fullName: id.fullName,
  };
  if (id.timezone !== null) update.timezone = id.timezone;
  const title = id.title?.trim();
  if (title) update.title = title;
  return {
    insert: { slackUserId: id.slackUserId, role: "member", ...update },
    update,
  };
}
