import type { SlackDeps, SlackBlock } from "./types";

export interface PrivateMessage {
  text: string;
  blocks: SlackBlock[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A31: "Only visible to you" in a channel. Best effort: Slack drops ephemerals for people who are
 * away and refuses non-members, so the DM copy is the one that has to arrive.
 */
export async function showOnlyTo(
  deps: Pick<SlackDeps, "slack">,
  channel: string,
  slackUserId: string,
  message: PrivateMessage,
): Promise<void> {
  try {
    await deps.slack.postEphemeral(channel, slackUserId, message.text, message.blocks);
  } catch (error) {
    console.error("slack: ephemeral post failed", channel, errorMessage(error));
  }
}

/** A31: the copy in the person's DM with the bot. Throws when it cannot be delivered. */
export async function sendDm(
  deps: Pick<SlackDeps, "slack">,
  slackUserId: string,
  message: PrivateMessage,
  options?: { unfurl?: boolean },
): Promise<void> {
  const channel = await deps.slack.openDm(slackUserId);
  await deps.slack.postMessage(channel, message.text, message.blocks, options);
}
