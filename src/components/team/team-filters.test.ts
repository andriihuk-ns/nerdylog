import { describe, expect, it } from "vitest";
import type { DirectoryUser } from "@/contracts";
import { parseTeamFilters, visibleUserIds } from "./team-filters";
import { teamHref } from "./team-summary";

const dir = (id: string, projectIds: string[], title: string | null = null): DirectoryUser => ({
  id,
  slackUserId: `U${id}`,
  fullName: id,
  email: `${id}@x.io`,
  avatarUrl: null,
  title,
  role: "member",
  timezone: "Europe/Kyiv",
  dailyNormHours: 8,
  ptoAllowanceDays: null,
  sickAllowanceDays: null,
  isActive: true,
  officeId: null,
  projectIds,
});

const people = [
  { userId: "ann", fullName: "Ann Lee" },
  { userId: "bo", fullName: "Bo Kim" },
  { userId: "ghost", fullName: "Ghost" },
];
const directory = [dir("ann", ["p1"], "Designer"), dir("bo", ["p2"])];

describe("parseTeamFilters", () => {
  it("keeps known projects and trims the query", () => {
    expect(parseTeamFilters("  ann ", "p1", ["p1"])).toEqual({ q: "ann", project: "p1" });
    expect(parseTeamFilters(["x"], "nope", ["p1"])).toEqual({ q: "", project: null });
  });
});

describe("visibleUserIds", () => {
  it("shows everyone without filters", () => {
    expect([...visibleUserIds(people, directory, { q: "", project: null })]).toEqual(["ann", "bo", "ghost"]);
  });

  it("searches name and title", () => {
    expect([...visibleUserIds(people, directory, { q: "design", project: null })]).toEqual(["ann"]);
    expect([...visibleUserIds(people, directory, { q: "ghost", project: null })]).toEqual(["ghost"]);
  });

  it("filters by project membership", () => {
    expect([...visibleUserIds(people, directory, { q: "", project: "p2" })]).toEqual(["bo"]);
  });
});

describe("teamHref with filters", () => {
  it("adds q and project", () => {
    expect(teamHref("2026-11", null, { q: " ann ", project: "p1" })).toBe("/team?month=2026-11&q=ann&project=p1");
  });
});
