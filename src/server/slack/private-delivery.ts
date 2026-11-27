import type { SlackDeps, SlackBlock } from "./types";

export interface PrivateMessage {
  text: string;
  blocks: SlackBlock[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A message in the person's DM with the bot. Throws when it cannot be delivered. */
export async function sendDm(deps: Pick<SlackDeps, "slack">, slackUserId: string, message: PrivateMessage): Promise<void> {
  const channel = await deps.slack.openDm(slackUserId);
  await deps.slack.postMessage(channel, message.text, message.blocks);
}

/**
 * A33: "Only visible to you" in the project channel. The bot DM is used only when Slack refuses
 * that (bot or person not in the channel). Slack reports success even if an away person never
 * sees an ephemeral. Throws when neither can be delivered.
 */
export async function showInChannelOrDm(
  deps: Pick<SlackDeps, "slack">,
  channel: string,
  slackUserId: string,
  message: PrivateMessage,
): Promise<void> {
  try {
    await deps.slack.postEphemeral(channel, slackUserId, message.text, message.blocks);
  } catch (error) {
    console.error("slack: ephemeral post failed", channel, errorMessage(error));
    await sendDm(deps, slackUserId, message);
  }
}
