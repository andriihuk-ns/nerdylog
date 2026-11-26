import { describe, expect, it } from "vitest";
import { isMissingScopeError, teamsErrorCode } from "./sync-result";

describe("isMissingScopeError", () => {
  it("detects a Slack platform error", () => {
    const err = Object.assign(new Error("An API error occurred: missing_scope"), { data: { ok: false, error: "missing_scope" } });
    expect(isMissingScopeError(err)).toBe(true);
  });

  it("detects a wrapped message", () => {
    expect(isMissingScopeError(new Error("usergroups.list failed: missing_scope"))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isMissingScopeError(new Error("ratelimited"))).toBe(false);
    expect(isMissingScopeError({ data: { error: "invalid_auth" } })).toBe(false);
    expect(isMissingScopeError(null)).toBe(false);
  });
});

describe("teamsErrorCode", () => {
  it("names the permission fix for missing scope", () => {
    expect(teamsErrorCode({ data: { error: "missing_scope" } })).toBe("missingScope");
  });

  it("falls back to a generic code", () => {
    expect(teamsErrorCode(new Error("boom"))).toBe("failed");
  });
});
