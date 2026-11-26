import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { LOGIN_PATH, safeNextPath } from "@/server/auth/route-rules";
import { isAllowedSlackTeam, slackClaimsFromUser } from "@/server/auth/slack-claims";
import { serverEnv } from "@/lib/env";
import { fetchSlackTitleWithTimeout } from "@/server/slack/profile";
import { getMyProfile, InactiveUserError, upsertUserFromSlack } from "@/server/services/user-service";
import { LOCALE_COOKIE, type Locale } from "@/contracts";

/**
 * GET /auth/callback?code=... — Supabase redirects here after Slack consent.
 * Exchanges the code for a session (sets auth cookies), rejects tokens from any Slack workspace other
 * than SLACK_TEAM_ID (before any user row is created), looks up the Slack profile title (A12, best effort),
 * binds the Slack identity to a Tempo user,
 * then redirects to `next` (default /my-time). Failures go to /login?error=<reason>.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (reason: string) => NextResponse.redirect(new URL(`${LOGIN_PATH}?error=${reason}`, origin));

  const code = searchParams.get("code");
  if (searchParams.get("error") || !code) return fail("oauth_denied");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("exchange_failed");

  const claims = slackClaimsFromUser(data.user);
  if (!claims) {
    await supabase.auth.signOut();
    return fail("missing_slack_identity");
  }
  if (!isAllowedSlackTeam(claims.teamId, serverEnv().SLACK_TEAM_ID)) {
    await supabase.auth.signOut();
    return fail("wrong_workspace");
  }
  // A12: profile title via bot users.info; capped at ~2 s and null on any failure, so it never blocks sign-in.
  const title = await fetchSlackTitleWithTimeout(claims.identity.slackUserId);
  const identity = { ...claims.identity, title };

  let actor: Awaited<ReturnType<typeof upsertUserFromSlack>>;
  try {
    actor = await upsertUserFromSlack(identity);
  } catch (err) {
    await supabase.auth.signOut();
    if (err instanceof InactiveUserError) return fail("inactive_user");
    console.error("auth/callback: upsertUserFromSlack failed", err instanceof Error ? err.message : err);
    return fail("user_link_failed");
  }

  // A14: the saved language wins from the first page after sign-in. Best effort: never blocks sign-in.
  let locale: Locale | null = null;
  try {
    locale = (await getMyProfile(actor)).locale;
  } catch {
    locale = null;
  }

  const res = NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
  if (locale) {
    res.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
