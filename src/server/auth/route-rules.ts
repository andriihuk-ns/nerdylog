/** Pages that require a signed-in user. Everything else is public at the proxy layer. */
export const PROTECTED_PREFIXES = ["/my-time", "/team", "/admin"] as const;

export const LOGIN_PATH = "/login";
export const POST_LOGIN_PATH = "/my-time";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Accepts only same-origin relative paths for post-login redirects (`?next=`).
 * Rejects absolute URLs, protocol-relative `//evil.com`, and backslash tricks.
 */
export function safeNextPath(next: string | null | undefined, fallback: string = POST_LOGIN_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
