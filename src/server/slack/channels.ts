import "server-only";
import type { JoinSlackChannelResult, SlackChannelOption } from "@/contracts";
import { getSlackClient } from "./client";

/** Minimal shape of the `conversations.*` methods we use, so tests can pass a fake. */
interface SlackConversation {
  id?: string;
  name?: string;
  is_private?: boolean;
  is_member?: boolean;
  is_archived?: boolean;
}
export interface ConversationsClient {
  conversations: {
    list(args: { types: string; exclude_archived: boolean; limit: number; cursor?: string }): Promise<{
      channels?: SlackConversation[];
      response_metadata?: { next_cursor?: string };
    }>;
    info(args: { channel: string }): Promise<{ channel?: SlackConversation }>;
    join(args: { channel: string }): Promise<unknown>;
  };
}

const PAGE_SIZE = 200;
const MAX_PAGES = 50; // 10 000 channels; a guard against a cursor loop

/**
 * A11 admin channel picker: non-archived public channels plus private channels the bot can
 * see (needs channels:read + groups:read). Sorted by name. Callers check the admin role first.
 */
export async function listSlackChannels(client: ConversationsClient = getSlackClient()): Promise<SlackChannelOption[]> {
  const out: SlackChannelOption[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await client.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    });
    for (const c of res.channels ?? []) {
      if (!c.id || !c.name || c.is_archived) continue;
      out.push({ id: c.id, name: c.name, isPrivate: c.is_private === true, isMember: c.is_member === true });
    }
    cursor = res.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Slack's error code from a @slack/web-api platform error (`error.data.error`), else the message. */
function slackErrorCode(error: unknown): string {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  if (data && typeof data.error === "string") return data.error;
  return error instanceof Error ? error.message : "unknown_error";
}

const PRIVATE_JOIN_ERRORS = new Set(["method_not_supported_for_channel_type", "is_private"]);

/**
 * A11: make the bot a member of a channel an admin picked. Already a member → ok; public →
 * conversations.join (needs channels:join); private and not a member → the admin must
 * `/invite @Tempo` first (bots cannot join private channels).
 */
export async function joinSlackChannel(
  channelId: string,
  client: ConversationsClient = getSlackClient(),
): Promise<JoinSlackChannelResult> {
  try {
    const { channel } = await client.conversations.info({ channel: channelId });
    if (channel?.is_member) return { ok: true };
    if (channel?.is_private) return privateNeedsInvite();
    await client.conversations.join({ channel: channelId });
    return { ok: true };
  } catch (error) {
    const code = slackErrorCode(error);
    if (code === "channel_not_found") return { ok: false, reason: "not_found", message: "Channel not found" };
    if (PRIVATE_JOIN_ERRORS.has(code)) return privateNeedsInvite();
    return { ok: false, reason: "error", message: `Slack error: ${code}` };
  }
}

function privateNeedsInvite(): JoinSlackChannelResult {
  return { ok: false, reason: "private_needs_invite", message: "Private channel: invite @nerdylog to it first" };
}

