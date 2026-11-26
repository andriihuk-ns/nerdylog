import { describe, expect, it } from "vitest";
import { isMissingScopeError, teamsErrorText, USERGROUPS_SCOPE_MESSAGE } from "./sync-result";

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

describe("teamsErrorText", () => {
  it("names the permission fix for missing scope", () => {
    expect(teamsErrorText({ data: { error: "missing_scope" } })).toBe(USERGROUPS_SCOPE_MESSAGE);
  });

  it("falls back to a generic message", () => {
    expect(teamsErrorText(new Error("boom"))).toBe("Teams couldn't be synced. Try again.");
  });
});
