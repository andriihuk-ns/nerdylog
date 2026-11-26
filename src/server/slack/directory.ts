import "server-only";
import type { SlackDirectoryMember } from "@/contracts";
import { getSlackClient } from "./client";
import { toDirectoryMembers, type SlackListMember } from "./directory-members";

/** Minimal shape of `client.users.list` so tests can pass a fake. */
export interface UsersListClient {
  users: {
    list(args: { limit: number; cursor?: string }): Promise<{
      members?: SlackListMember[];
      response_metadata?: { next_cursor?: string };
    }>;
  };
}

const PAGE_SIZE = 200;
const MAX_PAGES = 50; // 10 000 members; a guard against a cursor loop

/**
 * Admin "Sync from Slack" (FR-WEB-06): every real person in the workspace, paginated.
 * Callers must check the admin role first, then pass the result to syncDirectoryFromSlack.
 */
export async function fetchSlackDirectory(
  client: UsersListClient = getSlackClient(),
): Promise<SlackDirectoryMember[]> {
  const members: SlackListMember[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await client.users.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
    members.push(...(res.members ?? []));
    cursor = res.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  return toDirectoryMembers(members);
}
