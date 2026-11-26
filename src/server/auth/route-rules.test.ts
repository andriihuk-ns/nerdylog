import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "./route-rules";

describe("isProtectedPath", () => {
  it.each(["/my-time", "/my-time/2026-11", "/team", "/team/x", "/admin", "/admin/users"])("protects %s", (p) => {
    expect(isProtectedPath(p)).toBe(true);
  });

  it.each(["/", "/login", "/auth/callback", "/api/slack/commands", "/api/cron/morning-ping", "/teams", "/administrator"])(
    "does not protect %s",
    (p) => {
      expect(isProtectedPath(p)).toBe(false);
    },
  );
});

describe("safeNextPath", () => {
  it.each([
    ["/team?month=2026-11", "/team?month=2026-11"],
    ["/my-time", "/my-time"],
    ["/my-time/2026-11?view=week#today", "/my-time/2026-11?view=week#today"],
    ["/admin/users#row-3", "/admin/users#row-3"],
    // Percent-encoded tab stays encoded in the path: same-origin, harmless.
    ["/%09/evil.example", "/%09/evil.example"],
    ["/%2F/evil.example", "/%2F/evil.example"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "team",
    "https://evil.example",
    "http://evil.example/path",
    "javascript:alert(1)",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\/evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\r\n/evil.example",
    "\t//evil.example",
    " //evil.example",
    "/ /evil.example",
    " /my-time",
    "/my-time ",
    decodeURIComponent("/%09/evil.example"),
    decodeURIComponent("/%0A/evil.example"),
    "/\u0000/evil.example",
    "/\u007F/evil.example",
    "/ /evil.example",
    "/.//evil.example",
  ])("falls back for %j", (v) => {
    expect(safeNextPath(v)).toBe("/my-time");
  });

  it("uses the provided fallback", () => {
    expect(safeNextPath("//evil.example", "/team")).toBe("/team");
  });
});
