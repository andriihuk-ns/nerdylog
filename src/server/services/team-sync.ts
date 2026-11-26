import { z } from "zod";
import type { SlackUsergroup } from "@/contracts";
import type { ExistingTeam, NewTeam, TeamPatch } from "@/server/db/queries/teams";
import { parseInput } from "./validation";

/** Input shape from the Slack layer; ids trimmed, handle without a leading "@". */
export const slackUsergroupSchema = z.object({
  slackUsergroupId: z.string().trim().min(1),
  handle: z
    .string()
    .trim()
    .transform((h) => h.replace(/^@+/, "")),
  name: z.string().trim(),
  isActive: z.boolean(),
  memberSlackIds: z.array(z.string().trim()),
  defaultChannelIds: z.array(z.string()),
});

export type ParsedUsergroup = z.output<typeof slackUsergroupSchema>;

export interface TeamCreate {
  values: NewTeam;
  memberIds: string[]; // empty for a group created while disabled
}

export interface TeamUpdate {
  teamId: string;
  set: TeamPatch; // only changed fields; may be empty
  memberIds: string[] | null; // null = leave membership alone
}

export interface TeamSyncPlan {
  creates: TeamCreate[];
  updates: TeamUpdate[];
  archiveIds: string[]; // active teams whose group is gone from the input
  counts: { created: number; updated: number; archived: number; skippedMembers: number };
}

/** Validate before opening a transaction. Duplicate group ids: the last one wins. */
export function parseUsergroups(groups: readonly SlackUsergroup[]): ParsedUsergroup[] {
  const parsed = parseInput(z.array(slackUsergroupSchema), groups);
  return [...new Map(parsed.map((g) => [g.slackUsergroupId, g])).values()];
}

/**
 * Pure plan for SyncTeamsFromSlack (amendment A13). Upsert key: slack_usergroup_id.
 * - Active group: handle/name refreshed, membership replaced by its members that exist in Tempo.
 *   Unknown Slack ids are skipped and counted once per (group, Slack id).
 * - Disabled group: handle/name refreshed, `is_active = false`, membership kept (not replaced).
 * - Existing team missing from the input: `is_active = false`, membership kept.
 * - `slack_channel_id` is never part of the plan.
 * Counts: `archived` = teams that go from active to inactive (disabled or gone); `updated` = other
 * existing teams with any change (name, handle, reactivation, membership).
 */
export function planTeamSync(
  groups: readonly ParsedUsergroup[],
  existing: readonly ExistingTeam[],
  userIdBySlackId: ReadonlyMap<string, string>,
): TeamSyncPlan {
  const bySlackId = new Map(existing.map((t) => [t.slackUsergroupId, t]));
  const plan: TeamSyncPlan = {
    creates: [],
    updates: [],
    archiveIds: [],
    counts: { created: 0, updated: 0, archived: 0, skippedMembers: 0 },
  };
  const seen = new Set<string>();

  for (const g of groups) {
    seen.add(g.slackUsergroupId);
    const name = g.name || g.handle || g.slackUsergroupId;
    let memberIds: string[] | null = null;
    if (g.isActive) {
      const resolved = resolveMembers(g.memberSlackIds, userIdBySlackId);
      plan.counts.skippedMembers += resolved.skipped;
      memberIds = resolved.ids;
    }
    const team = bySlackId.get(g.slackUsergroupId);
    if (!team) {
      plan.creates.push({
        values: { slackUsergroupId: g.slackUsergroupId, handle: g.handle, name, isActive: g.isActive },
        memberIds: memberIds ?? [],
      });
      plan.counts.created++;
      continue;
    }
    const set: TeamPatch = {};
    if (team.handle !== g.handle) set.handle = g.handle;
    if (team.name !== name) set.name = name;
    if (team.isActive !== g.isActive) set.isActive = g.isActive;
    if (memberIds && sameIds(memberIds, team.memberIds)) memberIds = null;
    if (Object.keys(set).length === 0 && memberIds === null) continue;
    plan.updates.push({ teamId: team.id, set, memberIds });
    if (team.isActive && !g.isActive) plan.counts.archived++;
    else plan.counts.updated++;
  }

  for (const t of existing) {
    if (seen.has(t.slackUsergroupId) || !t.isActive) continue;
    plan.archiveIds.push(t.id);
    plan.counts.archived++;
  }
  return plan;
}

/** Distinct, sorted Tempo user ids; `skipped` = distinct non-empty Slack ids with no Tempo user. */
function resolveMembers(
  slackIds: readonly string[],
  userIdBySlackId: ReadonlyMap<string, string>,
): { ids: string[]; skipped: number } {
  const ids = new Set<string>();
  let skipped = 0;
  for (const slackId of new Set(slackIds)) {
    if (!slackId) continue;
    const userId = userIdBySlackId.get(slackId);
    if (userId) ids.add(userId);
    else skipped++;
  }
  return { ids: [...ids].sort(), skipped };
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

/** Every distinct Slack id referenced by active groups (for the user lookup). */
export function memberSlackIdsOf(groups: readonly ParsedUsergroup[]): string[] {
  const ids = new Set<string>();
  for (const g of groups) if (g.isActive) for (const id of g.memberSlackIds) if (id) ids.add(id);
  return [...ids];
}
