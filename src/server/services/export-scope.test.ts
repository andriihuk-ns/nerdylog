import { describe, expect, it } from "vitest";
import { ForbiddenError, InvalidInputError } from "./errors";
import { resolveExportRange } from "./export-scope";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const member = { userId: ME, role: "member" as const };
const manager = { userId: ME, role: "manager" as const };
const base = { from: "2026-11-01", to: "2026-11-30" };

describe("resolveExportRange RBAC", () => {
  it("member without userIds exports only themselves", () => {
    expect(resolveExportRange(member, base).users).toEqual([ME]);
  });

  it("member may name themselves but nobody else", () => {
    expect(resolveExportRange(member, { ...base, userIds: [ME] }).users).toEqual([ME]);
    expect(() => resolveExportRange(member, { ...base, userIds: [ME, OTHER] })).toThrow(ForbiddenError);
  });

  it("manager defaults to all active users, or exactly the named users", () => {
    expect(resolveExportRange(manager, base).users).toBe("active");
    expect(resolveExportRange(manager, { ...base, userIds: [OTHER, OTHER] }).users).toEqual([OTHER]);
  });

  it("passes project filters through, deduplicated", () => {
    expect(resolveExportRange(manager, { ...base, projectIds: [PROJECT, PROJECT] }).projectIds).toEqual([PROJECT]);
    expect(resolveExportRange(manager, base)).not.toHaveProperty("projectIds");
  });
});

describe("resolveExportRange validation", () => {
  it("rejects impossible, reversed and over-long ranges with RangeError", () => {
    expect(() => resolveExportRange(member, { from: "2026-02-30", to: "2026-03-01" })).toThrow(RangeError);
    expect(() => resolveExportRange(member, { from: "2026-12-01", to: "2026-11-01" })).toThrow(RangeError);
    expect(() => resolveExportRange(member, { from: "2025-01-01", to: "2026-11-30" })).toThrow(RangeError);
  });

  it("accepts a full leap year (366 days)", () => {
    expect(resolveExportRange(member, { from: "2028-01-01", to: "2028-12-31" }).to).toBe("2028-12-31");
  });

  it("rejects non-uuid ids with InvalidInputError", () => {
    expect(() => resolveExportRange(manager, { ...base, userIds: ["nope"] })).toThrow(InvalidInputError);
  });
});
