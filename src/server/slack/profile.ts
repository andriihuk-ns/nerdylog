import "server-only";
import { getSlackClient } from "./client";

/** Minimal shape of `client.users.info` so tests can pass a fake. */
export interface UsersInfoClient {
  users: {
    info(args: { user: string }): Promise<{ user?: { profile?: { title?: string } } }>;
  };
}

/** Default cap for the sign-in lookup: a slow Slack must not block the auth callback. */
export const TITLE_LOOKUP_TIMEOUT_MS = 2000;

/** The Slack error code only (e.g. "user_not_found"); never the token or the payload. */
function slackErrorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const data = (err as { data?: { error?: unknown } }).data;
    if (typeof data?.error === "string") return data.error;
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "unknown_error";
}

/**
 * A12: the member's Slack profile title via bot `users.info` (scope users:read).
 * Returns the trimmed title, or null when blank or on any failure. Never throws.
 */
export async function fetchSlackTitle(slackUserId: string, client?: UsersInfoClient): Promise<string | null> {
  try {
    const res = await (client ?? getSlackClient()).users.info({ user: slackUserId });
    return res.user?.profile?.title?.trim() || null;
  } catch (err) {
    console.warn("slack/profile: users.info failed", slackErrorCode(err));
    return null;
  }
}

/** fetchSlackTitle capped at `timeoutMs`; a timeout resolves to null. Never throws. */
export async function fetchSlackTitleWithTimeout(
  slackUserId: string,
  timeoutMs: number = TITLE_LOOKUP_TIMEOUT_MS,
  client?: UsersInfoClient,
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn("slack/profile: users.info timed out");
      resolve(null);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetchSlackTitle(slackUserId, client), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
