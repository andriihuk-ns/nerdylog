import { slackIdentitySchema, type SlackIdentity } from "@/contracts";

/** Minimal shape of the Supabase `User` we read; avoids coupling to the full auth-js type. */
export interface SupabaseUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: { provider: string; identity_data?: Record<string, unknown> | null }[] | null;
}

const SLACK_USER_ID_CLAIM = "https://slack.com/user_id";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function claim(sources: Record<string, unknown>[], key: string): string | null {
  for (const source of sources) {
    const direct = str(source[key]);
    if (direct) return direct;
    const custom = source.custom_claims;
    if (custom && typeof custom === "object") {
      const nested = str((custom as Record<string, unknown>)[key]);
      if (nested) return nested;
    }
  }
  return null;
}

function validUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Maps a Supabase user created by the `slack_oidc` provider to a SlackIdentity.
 * Supabase stores non-standard OIDC claims under `user_metadata.custom_claims`; we also check the
 * top level and the slack_oidc identity_data. Slack OIDC has no timezone claim → timezone: null.
 * Returns null when the Slack user id is missing or the result fails the contract schema.
 */
export function slackIdentityFromUser(user: SupabaseUserLike): SlackIdentity | null {
  const identity = user.identities?.find((i) => i.provider === "slack_oidc")?.identity_data ?? {};
  const sources = [user.user_metadata ?? {}, identity];

  const slackUserId = claim(sources, SLACK_USER_ID_CLAIM);
  if (!slackUserId) return null;

  const parsed = slackIdentitySchema.safeParse({
    authUserId: user.id,
    slackUserId,
    email: str(user.email) ?? claim(sources, "email"),
    fullName: claim(sources, "name") ?? claim(sources, "full_name") ?? "",
    avatarUrl: validUrl(claim(sources, "picture") ?? claim(sources, "avatar_url")),
    timezone: null,
  });
  return parsed.success ? parsed.data : null;
}
