import { slackIdentitySchema, type SlackIdentity } from "@/contracts";

/** Minimal shape of the Supabase `User` we read; avoids coupling to the full auth-js type. */
export interface SupabaseUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: { provider: string; identity_data?: Record<string, unknown> | null }[] | null;
}

const SLACK_USER_ID_CLAIM = "https://slack.com/user_id";
const SLACK_TEAM_ID_CLAIM = "https://slack.com/team_id";
/** Slack member ids: U… (regular) or W… (Enterprise Grid). */
const SLACK_MEMBER_ID = /^[UW][A-Z0-9]{6,}$/;

/** Result of mapping a slack_oidc user: the contract identity plus the Slack workspace (team) id. */
export interface SlackClaims {
  identity: SlackIdentity;
  /** `https://slack.com/team_id` claim; null when absent. Callers must check it against SLACK_TEAM_ID. */
  teamId: string | null;
}

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

function claimSources(user: SupabaseUserLike): Record<string, unknown>[] {
  const identity = user.identities?.find((i) => i.provider === "slack_oidc")?.identity_data ?? {};
  return [user.user_metadata ?? {}, identity];
}

/**
 * Maps a Supabase user created by the `slack_oidc` provider to a SlackIdentity.
 * Supabase stores non-standard OIDC claims under `user_metadata.custom_claims`; we also check the
 * top level and the slack_oidc identity_data. Slack OIDC has no timezone claim → timezone: null.
 * Returns null when the Slack user id is missing or the result fails the contract schema.
 * Does NOT check the workspace; use `slackClaimsFromUser` + `isAllowedSlackTeam` for sign-in.
 */
export function slackIdentityFromUser(user: SupabaseUserLike): SlackIdentity | null {
  const sources = claimSources(user);

  // Supabase's slack_oidc provider stores the Slack member id as `provider_id` / `sub`
  // (verified on a real sign-in, 2026-11-26); the namespaced claim is kept as a fallback.
  const slackUserId = [claim(sources, SLACK_USER_ID_CLAIM), claim(sources, "provider_id"), claim(sources, "sub")].find(
    (v): v is string => v !== null && SLACK_MEMBER_ID.test(v),
  );
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

/** Identity plus the Slack team id claim (same lookup order as the user id). Null when no valid identity. */
export function slackClaimsFromUser(user: SupabaseUserLike): SlackClaims | null {
  const identity = slackIdentityFromUser(user);
  if (!identity) return null;
  return { identity, teamId: claim(claimSources(user), SLACK_TEAM_ID_CLAIM) };
}

/** True only when the token's team id is present and equals the configured workspace id. */
export function isAllowedSlackTeam(teamId: string | null | undefined, expectedTeamId: string): boolean {
  return typeof teamId === "string" && teamId !== "" && expectedTeamId !== "" && teamId === expectedTeamId;
}
