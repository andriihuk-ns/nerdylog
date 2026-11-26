import "server-only";
import type { SlackUsergroup } from "@/contracts";
import { getSlackClient } from "./client";

/** Minimal shape of the `usergroups.*` methods we use, so tests can pass a fake. */
interface SlackApiUsergroup {
  id?: string;
  handle?: string;
  name?: string;
  date_delete?: number;
  users?: string[];
  prefs?: { channels?: string[] };
}
export interface UsergroupsClient {
  usergroups: {
    list(args: { include_disabled: boolean; include_users: boolean }): Promise<{ usergroups?: SlackApiUsergroup[] }>;
    users: {
      list(args: { usergroup: string; include_disabled: boolean }): Promise<{ users?: string[] }>;
    };
  };
}

/**
 * A13 "Sync from Slack": every user group in the workspace, disabled ones included (needs
 * `usergroups:read`). Slack's usergroups.list returns all groups in one response (no cursor).
 * A group whose `users` is missing is filled from usergroups.users.list. Callers check the
 * admin role first, then pass the result to syncTeamsFromSlack.
 */
export async function fetchSlackUsergroups(client: UsergroupsClient = getSlackClient()): Promise<SlackUsergroup[]> {
  const res = await client.usergroups.list({ include_disabled: true, include_users: true });
  const groups = (res.usergroups ?? []).filter((g): g is SlackApiUsergroup & { id: string } => Boolean(g.id));
  return Promise.all(
    groups.map(async (g) => ({
      slackUsergroupId: g.id,
      handle: (g.handle ?? "").replace(/^@/, ""),
      name: g.name || g.handle || g.id,
      isActive: !(g.date_delete && g.date_delete > 0),
      memberSlackIds: g.users ?? (await listGroupUsers(client, g.id)),
      defaultChannelIds: g.prefs?.channels ?? [],
    })),
  );
}

async function listGroupUsers(client: UsergroupsClient, usergroup: string): Promise<string[]> {
  const res = await client.usergroups.users.list({ usergroup, include_disabled: true });
  return res.users ?? [];
}
