import { describe, expect, it } from "vitest";
import type { DirectoryUser } from "@/contracts";
import { ALL, EMPTY_FILTERS, filterDirectory, hasFilters, NONE } from "./directory-filters";

function user(id: string, patch: Partial<DirectoryUser> = {}): DirectoryUser {
  return {
    id,
    slackUserId: `U${id}`,
    fullName: id,
    email: `${id.toLowerCase()}@x.io`,
    title: null,
    avatarUrl: null,
    role: "member",
    timezone: "Europe/Kyiv",
    dailyNormHours: 8,
    ptoAllowanceDays: null,
    isActive: true,
    officeId: null,
    projectIds: [],
    ...patch,
  };
}

const users = [
  user("Zoe", { officeId: "ua", projectIds: ["p1"], title: "Designer" }),
  user("Adam", { officeId: "pl", projectIds: ["p1", "p2"] }),
  user("Bob", { isActive: false }),
];

describe("filterDirectory", () => {
  it("sorts active first, then by name", () => {
    expect(filterDirectory(users, EMPTY_FILTERS).map((u) => u.id)).toEqual(["Adam", "Zoe", "Bob"]);
  });

  it("searches name, email and title", () => {
    expect(filterDirectory(users, { ...EMPTY_FILTERS, query: "design" }).map((u) => u.id)).toEqual(["Zoe"]);
    expect(filterDirectory(users, { ...EMPTY_FILTERS, query: "bob@" }).map((u) => u.id)).toEqual(["Bob"]);
  });

  it("filters by project and office (including no office)", () => {
    expect(filterDirectory(users, { ...EMPTY_FILTERS, projectId: "p2" }).map((u) => u.id)).toEqual(["Adam"]);
    expect(filterDirectory(users, { ...EMPTY_FILTERS, officeId: "ua" }).map((u) => u.id)).toEqual(["Zoe"]);
    expect(filterDirectory(users, { ...EMPTY_FILTERS, officeId: NONE }).map((u) => u.id)).toEqual(["Bob"]);
    expect(filterDirectory(users, { query: "a", projectId: "p1", officeId: ALL }).map((u) => u.id)).toEqual(["Adam"]);
  });

  it("knows when filters are applied", () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasFilters({ ...EMPTY_FILTERS, query: " x " })).toBe(true);
  });
});
