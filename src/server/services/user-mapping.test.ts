import { describe, expect, it } from "vitest";
import { buildUserUpsert } from "./user-mapping";

const identity = {
  authUserId: "7f0c1a52-8f1e-4c1b-9a35-3b1f8f0f6a01",
  slackUserId: "U123",
  email: "sv@example.com",
  fullName: "Sviatoslav",
  avatarUrl: "https://example.com/a.png",
  timezone: "Europe/Kyiv",
  title: "Product Designer",
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
      title: "Product Designer",
    });
  });

  it("never updates role, slack id, norm or active flag on conflict", () => {
    const { update } = buildUserUpsert(identity);
    expect(Object.keys(update).sort()).toEqual(["authUserId", "avatarUrl", "email", "fullName", "timezone", "title"]);
  });

  it("omits timezone when Slack sends none, so the stored/default value stays", () => {
    const { insert, update } = buildUserUpsert({ ...identity, timezone: null });
    expect(update).not.toHaveProperty("timezone");
    expect(insert).not.toHaveProperty("timezone");
  });

  it("writes a trimmed title; null or blank keeps the stored title (A12)", () => {
    expect(buildUserUpsert({ ...identity, title: "  Engineer " }).update.title).toBe("Engineer");
    for (const title of [null, "", "   "]) {
      const { insert, update } = buildUserUpsert({ ...identity, title });
      expect(update).not.toHaveProperty("title");
      expect(insert).not.toHaveProperty("title");
    }
  });

  it("rejects an invalid identity", () => {
    expect(() => buildUserUpsert({ ...identity, authUserId: "nope" })).toThrow();
    expect(() => buildUserUpsert({ ...identity, slackUserId: "" })).toThrow();
  });
});
