import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { LOGIN_PATH, safeNextPath } from "@/server/auth/route-rules";

/**
 * GET /auth/sign-in?next=/team — starts Sign in with Slack (Supabase `slack_oidc`).
 * The /login page links here (plain <a href="/auth/sign-in">, or a form with method="get").
 * Supabase stores the PKCE verifier in a cookie, then we redirect the browser to Slack.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "slack_oidc",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=oauth_start`, origin));
  }
  return NextResponse.redirect(data.url);
}
