import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { LOGIN_PATH, safeNextPath } from "@/server/auth/route-rules";
import { slackIdentityFromUser } from "@/server/auth/slack-claims";
import { InactiveUserError, upsertUserFromSlack } from "@/server/services/user-service";

/**
 * GET /auth/callback?code=... — Supabase redirects here after Slack consent.
 * Exchanges the code for a session (sets auth cookies), binds the Slack identity to a Tempo user,
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

  const identity = slackIdentityFromUser(data.user);
  if (!identity) {
    await supabase.auth.signOut();
    return fail("missing_slack_identity");
  }

  try {
    await upsertUserFromSlack(identity);
  } catch (err) {
    await supabase.auth.signOut();
    if (err instanceof InactiveUserError) return fail("inactive_user");
    console.error("auth/callback: upsertUserFromSlack failed", err instanceof Error ? err.message : err);
    return fail("user_link_failed");
  }

  return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
}
