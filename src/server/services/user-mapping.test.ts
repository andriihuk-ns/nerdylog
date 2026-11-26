import { describe, expect, it } from "vitest";
import { buildUserUpsert } from "./user-mapping";

const identity = {
  authUserId: "7f0c1a52-8f1e-4c1b-9a35-3b1f8f0f6a01",
  slackUserId: "U123",
  email: "sv@example.com",
  fullName: "Sviatoslav",
  avatarUrl: "https://example.com/a.png",
  timezone: "Europe/Kyiv",
};

describe("buildUserUpsert", () => {
  it("inserts new users as members with all identity fields", () => {
    const { insert } = buildUserUpsert(identity);
    expect(insert).toEqual({
      slackUserId: "U123",
      role: "member",
      authUserId: identity.authUserId,
      email: "sv@example.com",
      avatarUrl: "https://example.com/a.png",
      fullName: "Sviatoslav",
      timezone: "Europe/Kyiv",
    });
  });

  it("never updates role, slack id, norm or active flag on conflict", () => {
    const { update } = buildUserUpsert(identity);
    expect(Object.keys(update).sort()).toEqual(["authUserId", "avatarUrl", "email", "fullName", "timezone"]);
  });

  it("omits timezone when Slack sends none, so the stored/default value stays", () => {
    const { insert, update } = buildUserUpsert({ ...identity, timezone: null });
    expect(update).not.toHaveProperty("timezone");
    expect(insert).not.toHaveProperty("timezone");
  });

  it("rejects an invalid identity", () => {
    expect(() => buildUserUpsert({ ...identity, authUserId: "nope" })).toThrow();
    expect(() => buildUserUpsert({ ...identity, slackUserId: "" })).toThrow();
  });
});
