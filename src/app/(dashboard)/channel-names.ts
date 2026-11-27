import "server-only";
import { listSlackChannelsCached } from "@/server/slack/channels";

const SLACK_WAIT_MS = 2000;

/**
 * A15: channel id → name for "Ask {creator} to add you to #channel". Uses the 10-minute
 * server cache; Slack missing, slow (> 2s) or failing → empty map (callers fall back to generic copy).
 */
export async function loadChannelNames(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), SLACK_WAIT_MS);
    });
    const channels = await Promise.race([listSlackChannelsCached(), timeout]);
    const wanted = new Set(ids);
    return new Map((channels ?? []).filter((c) => wanted.has(c.id)).map((c) => [c.id, c.name]));
  } catch (err) {
    console.warn("channel names unavailable", err instanceof Error ? err.message : err);
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}
