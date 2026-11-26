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
  it("keeps relative paths", () => {
    expect(safeNextPath("/team?month=2026-11")).toBe("/team?month=2026-11");
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "team"])("falls back for %s", (v) => {
    expect(safeNextPath(v)).toBe("/my-time");
  });
});
