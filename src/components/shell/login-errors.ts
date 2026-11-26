/** /login?error=<code> → readable sentence. Codes come from src/app/auth/** routes. */
const MESSAGES: Record<string, string> = {
  oauth_denied: "Slack sign-in was cancelled. Try again when you're ready.",
  oauth_start: "We couldn't reach Slack to start sign-in. Try again in a moment.",
  exchange_failed: "Slack sign-in expired or was already used. Please sign in again.",
  missing_slack_identity: "Slack didn't share your user ID with nerdylog. Ask an admin to check the Slack app's scopes.",
  user_link_failed: "Signed in with Slack, but we couldn't link your nerdylog account. Try again or contact an admin.",
  inactive_user: "Your nerdylog account is archived. Ask an admin to reactivate it.",
  wrong_workspace: "This Slack workspace isn't connected to nerdylog. Sign in with your team's workspace.",
};

export function loginErrorMessage(code: string | string[] | undefined): string | null {
  if (typeof code !== "string" || code === "") return null;
  return MESSAGES[code] ?? "Sign-in failed. Please try again.";
}

/** `/auth/sign-in?next=…` for a same-origin path; anything else falls back to the default. */
export function signInHref(next: string | string[] | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/auth/sign-in";
  return `/auth/sign-in?next=${encodeURIComponent(next)}`;
}
