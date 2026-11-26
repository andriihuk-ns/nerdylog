import { describe, expect, it } from "vitest";
import type { SlackDirectoryMember } from "@/contracts";
import { planDirectorySync } from "./directory-sync";
import { InvalidInputError } from "./errors";

const member = (over: Partial<SlackDirectoryMember> = {}): SlackDirectoryMember => ({
  slackUserId: "U1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: "https://example.com/a.png",
  timezone: "Europe/Kyiv",
  title: "Product Designer",
  ...over,
});

describe("planDirectorySync", () => {
  it("inserts unknown Slack users as active members", () => {
    const plan = planDirectorySync([member()], new Set());
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([
      {
        slackUserId: "U1",
        role: "member",
        isActive: true,
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        avatarUrl: "https://example.com/a.png",
        timezone: "Europe/Kyiv",
        title: "Product Designer",
      },
    ]);
  });

  it("updates only profile fields of existing users, never role/norm/allowance/auth/active", () => {
    const plan = planDirectorySync([member()], new Set(["U1"]));
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      {
        slackUserId: "U1",
        set: {
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          avatarUrl: "https://example.com/a.png",
          timezone: "Europe/Kyiv",
          title: "Product Designer",
        },
      },
    ]);
    const keys = Object.keys(plan.updates[0].set);
    for (const forbidden of ["role", "dailyNormHours", "ptoAllowanceDays", "authUserId", "isActive"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("keeps stored values when Slack sends blanks, nulls or an unknown zone", () => {
    const plan = planDirectorySync(
      [member({ fullName: "  ", email: null, avatarUrl: null, timezone: "Nowhere/City", title: null })],
      new Set(["U1"]),
    );
    expect(plan.updates[0].set).toEqual({});
  });

  it("title: trimmed when sent, blank clears to null, null keeps stored (A12)", () => {
    const plan = planDirectorySync(
      [member({ slackUserId: "U1", title: " Engineer " }), member({ slackUserId: "U2", title: "  " }), member({ slackUserId: "U3", title: null })],
      new Set(["U1", "U2", "U3"]),
    );
    expect(plan.updates.map((u) => u.set.title)).toEqual(["Engineer", null, undefined]);
    expect(plan.updates[2].set).not.toHaveProperty("title");
  });

  it("new users without a timezone get the DB default (field omitted)", () => {
    const [insert] = planDirectorySync([member({ timezone: null })], new Set()).inserts;
    expect(insert).not.toHaveProperty("timezone");
  });

  it("deduplicates by Slack id (last wins) and trims ids", () => {
    const plan = planDirectorySync([member({ fullName: "Old" }), member({ slackUserId: " U1 ", fullName: "New" })], new Set());
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].fullName).toBe("New");
  });

  it("rejects an empty Slack id with field errors", () => {
    try {
      planDirectorySync([member({ slackUserId: " " })], new Set());
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidInputError);
      expect(Object.keys((e as InvalidInputError).fieldErrors)).toEqual(["0.slackUserId"]);
    }
  });
});
