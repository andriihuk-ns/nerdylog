import "server-only";
import type { SlackChannelOption } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { listSlackChannelsCached } from "@/server/slack/channels";

const SLACK_WAIT_MS = 4000;

/**
 * A11: workspace channels for the admin pickers, loaded once per render.
 * Slack not configured, unreachable, rate-limited or slower than 4s → null; the pickers render
 * disabled and the page still loads. The list itself is cached for 10 minutes (server-side).
 */
export async function loadSlackChannels(): Promise<SlackChannelOption[] | null> {
  await requireActor(["admin"]);
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), SLACK_WAIT_MS);
    });
    try {
      return await Promise.race([listSlackChannelsCached(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn("listSlackChannels failed", err instanceof Error ? err.message : err);
    return null;
  }
}
