import "server-only";
import type { SlackChannelOption } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listSlackChannels } from "@/server/slack/channels";

/**
 * A11: workspace channels for the admin pickers, loaded once per render.
 * Slack not configured or unreachable → null; the pickers render disabled and the page still loads.
 */
export async function loadSlackChannels(): Promise<SlackChannelOption[] | null> {
  await requireActor(["admin"]);
  try {
    return await listSlackChannels();
  } catch (err) {
    console.warn("listSlackChannels failed", err instanceof Error ? err.message : err);
    return null;
  }
}
