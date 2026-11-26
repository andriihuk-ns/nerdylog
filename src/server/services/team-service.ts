import type { ListStandupChannelsForUser, ListTeams, SyncTeamsFromSlack, UpdateTeamChannel } from "@/contracts";
import { getDb } from "@/server/db/client";
import {
  findUserIdsBySlackIds,
  insertTeam,
  listActiveTeamChannelsForUser,
  listTeamsForSync,
  listTeamViews,
  replaceTeamMembers,
  updateTeamChannelRow,
  updateTeamRow,
} from "@/server/db/queries/teams";
import { InvalidInputError, NotFoundError } from "./errors";
import { isUniqueViolation } from "./pg-errors";
import { assertAdmin, assertManagerOrAdmin } from "./rbac";
import { getStandupChannelId } from "./settings-service";
import { memberSlackIdsOf, parseUsergroups, planTeamSync } from "./team-sync";
import { assertRowId, isRowId, parseInput, slackChannelIdSchema } from "./validation";

/** Amendment A13: teams mirror Slack user groups; admins pick one channel per team. */

/** Postgres name of the teams.slack_channel_id unique constraint (drizzle/0007_teams.sql). */
export const TEAMS_SLACK_CHANNEL_UNIQUE = "teams_slack_channel_id_unique";

/** Contract ListTeams (manager+). Active teams only unless `includeArchived`. */
export const listTeams: ListTeams = async (actor, opts) => {
  assertManagerOrAdmin(actor);
  return listTeamViews(getDb(), opts?.includeArchived ?? false);
};

/** Contract UpdateTeamChannel (admin). null or blank clears the channel. */
export const updateTeamChannel: UpdateTeamChannel = async (actor, teamId, slackChannelId) => {
  assertAdmin(actor);
  assertRowId(teamId, "Team");
  const channel = parseInput(slackChannelIdSchema, slackChannelId);
  try {
    const view = await updateTeamChannelRow(getDb(), teamId, channel);
    if (!view) throw new NotFoundError("Team not found");
    return view;
  } catch (error) {
    if (isUniqueViolation(error, TEAMS_SLACK_CHANNEL_UNIQUE)) {
      throw InvalidInputError.field("slackChannelId", "This channel is already linked to another team");
    }
    throw error;
  }
};

/** Contract SyncTeamsFromSlack (admin). Plan is pure (team-sync.ts); all writes in one transaction. */
export const syncTeamsFromSlack: SyncTeamsFromSlack = async (actor, groups) => {
  assertAdmin(actor);
  const parsed = parseUsergroups(groups); // validate before opening a transaction
  return getDb().transaction(async (tx) => {
    const existing = await listTeamsForSync(tx);
    const userIds = await findUserIdsBySlackIds(tx, memberSlackIdsOf(parsed));
    const plan = planTeamSync(parsed, existing, userIds);
    for (const c of plan.creates) {
      const teamId = await insertTeam(tx, c.values);
      if (c.memberIds.length > 0) await replaceTeamMembers(tx, teamId, c.memberIds);
    }
    for (const u of plan.updates) {
      if (Object.keys(u.set).length > 0) await updateTeamRow(tx, u.teamId, u.set);
      if (u.memberIds) await replaceTeamMembers(tx, u.teamId, u.memberIds);
    }
    for (const teamId of plan.archiveIds) await updateTeamRow(tx, teamId, { isActive: false });
    return plan.counts;
  });
};

/**
 * Contract ListStandupChannelsForUser (system, no actor). Distinct channels of the user's active
 * teams; none → the general standup channel (A11) as a one-element list; that unset too → [].
 */
export const listStandupChannelsForUser: ListStandupChannelsForUser = async (userId) => {
  const teamChannels = isRowId(userId) ? await listActiveTeamChannelsForUser(getDb(), userId) : [];
  if (teamChannels.length > 0) return teamChannels;
  const general = await getStandupChannelId();
  return general ? [general] : [];
};
