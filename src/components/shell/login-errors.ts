/** /login?error=<code> → key under `login.errors` in messages/*.json. Codes come from src/app/auth/** routes. */
export const LOGIN_ERROR_CODES = [
  "oauth_denied",
  "oauth_start",
  "exchange_failed",
  "missing_slack_identity",
  "user_link_failed",
  "inactive_user",
  "wrong_workspace",
] as const;

export type LoginErrorKey = (typeof LOGIN_ERROR_CODES)[number] | "unknown";

export function loginErrorKey(code: string | string[] | undefined): LoginErrorKey | null {
  if (typeof code !== "string" || code === "") return null;
  return (LOGIN_ERROR_CODES as readonly string[]).includes(code) ? (code as LoginErrorKey) : "unknown";
}

/** `/auth/sign-in?next=…` for a same-origin path; anything else falls back to the default. */
export function signInHref(next: string | string[] | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/auth/sign-in";
  return `/auth/sign-in?next=${encodeURIComponent(next)}`;
}
