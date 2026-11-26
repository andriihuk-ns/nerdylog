import { z } from "zod";
import type { SlackDirectoryMember } from "@/contracts";
import type { UserInsert } from "@/server/db/schema";
import { parseInput, isValidTimeZone } from "./validation";

export const slackDirectoryMemberSchema = z.object({
  slackUserId: z.string().trim().min(1),
  fullName: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  timezone: z.string().nullable(),
});

export type ProfileUpdate = Partial<Pick<UserInsert, "fullName" | "email" | "avatarUrl" | "timezone">>;

export interface DirectorySyncPlan {
  inserts: UserInsert[];
  updates: Array<{ slackUserId: string; set: ProfileUpdate }>;
}

/**
 * Pure plan for SyncDirectoryFromSlack. Upsert key: slack_user_id (last duplicate wins).
 * New rows → role member, active, Slack profile. Existing rows → only profile fields that
 * Slack actually sent (empty name / null email / null avatar / unknown tz keep the stored value).
 * role, daily_norm_hours, pto_allowance_days, is_active and auth_user_id are never written.
 */
export function planDirectorySync(
  members: readonly SlackDirectoryMember[],
  existingSlackIds: ReadonlySet<string>,
): DirectorySyncPlan {
  const parsed = parseInput(z.array(slackDirectoryMemberSchema), members);
  const unique = new Map(parsed.map((m) => [m.slackUserId, m]));
  const plan: DirectorySyncPlan = { inserts: [], updates: [] };
  for (const m of unique.values()) {
    const set = profileFields(m);
    if (existingSlackIds.has(m.slackUserId)) {
      plan.updates.push({ slackUserId: m.slackUserId, set });
    } else {
      plan.inserts.push({ slackUserId: m.slackUserId, role: "member", isActive: true, fullName: "", ...set });
    }
  }
  return plan;
}

function profileFields(m: z.output<typeof slackDirectoryMemberSchema>): ProfileUpdate {
  const set: ProfileUpdate = {};
  const name = m.fullName.trim();
  if (name) set.fullName = name;
  if (m.email) set.email = m.email;
  if (m.avatarUrl) set.avatarUrl = m.avatarUrl;
  if (m.timezone && isValidTimeZone(m.timezone)) set.timezone = m.timezone;
  return set;
}
