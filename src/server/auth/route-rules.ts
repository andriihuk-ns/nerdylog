/** Pages that require a signed-in user. Everything else is public at the proxy layer. */
export const PROTECTED_PREFIXES = ["/my-time", "/team", "/admin"] as const;

export const LOGIN_PATH = "/login";
export const POST_LOGIN_PATH = "/my-time";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const PROBE_ORIGIN = "http://tempo.invalid";
// Any ASCII control char (incl. tab/CR/LF, which the URL parser silently strips) or whitespace.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\s]/;

/**
 * Accepts only same-origin relative paths for post-login redirects (`?next=`).
 * Rejects control chars/whitespace, absolute URLs, protocol-relative `//evil.com`, and backslash
 * tricks, then resolves against a probe origin and requires the origin to be unchanged.
 * Returns the normalised `pathname + search + hash`.
 */
export function safeNextPath(next: string | null | undefined, fallback: string = POST_LOGIN_PATH): string {
  if (!next || UNSAFE_CHARS.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("//") ? fallback : path;
}
