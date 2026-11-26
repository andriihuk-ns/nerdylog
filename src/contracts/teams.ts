import type { Actor } from "./users";

/** A13: a Tempo team mirrors one Slack user group. */
export interface TeamView {
  id: string;
  slackUsergroupId: string;
  handle: string; // "design" (without @)
  name: string;
  slackChannelId: string | null;
  isActive: boolean;
  memberIds: string[]; // Tempo user ids
}

/** One Slack user group as read by the Slack layer (src/server/slack/usergroups.ts). */
export interface SlackUsergroup {
  slackUsergroupId: string;
  handle: string;
  name: string;
  isActive: boolean; // false when disabled in Slack
  memberSlackIds: string[];
  defaultChannelIds: string[]; // group's default channels in Slack; first one is the suggestion
}

/** src/server/slack/usergroups.ts — paginated, includes disabled groups. */
export type FetchSlackUsergroups = () => Promise<SlackUsergroup[]>;

/** src/server/services/team-service.ts */
export type ListTeams = (actor: Actor, opts?: { includeArchived?: boolean }) => Promise<TeamView[]>; // manager+
export type UpdateTeamChannel = (actor: Actor, teamId: string, slackChannelId: string | null) => Promise<TeamView>; // admin
/**
 * admin only. Upserts teams by slack_usergroup_id; replaces membership with members that exist in
 * Tempo (unknown Slack ids are skipped and counted); groups missing from `groups` become inactive.
 * Never touches slack_channel_id.
 */
export type SyncTeamsFromSlack = (
  actor: Actor,
  groups: SlackUsergroup[],
) => Promise<{ created: number; updated: number; archived: number; skippedMembers: number }>;
/**
 * System read for standup routing (no actor): distinct channel ids of the user's active teams;
 * when that list is empty, the general standup channel (A11) if set; else [].
 */
export type ListStandupChannelsForUser = (userId: string) => Promise<string[]>;
