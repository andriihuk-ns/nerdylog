import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import uk from "../../../messages/uk.json";
import type { DirectoryUser, TeamView } from "@/contracts";
import { resolveMembers, splitTeams, syncSummary, takenTeamChannels, teamHandlesByUser } from "./team-helpers";

const team = (over: Partial<TeamView>): TeamView => ({
  id: "t",
  slackUsergroupId: "S1",
  handle: "x",
  name: "X",
  slackChannelId: null,
  isActive: true,
  memberIds: [],
  ...over,
});

const user = (id: string, fullName: string, isActive = true): DirectoryUser => ({
  id,
  slackUserId: `U${id}`,
  fullName,
  email: null,
  avatarUrl: null,
  title: null,
  role: "member",
  timezone: "UTC",
  dailyNormHours: 8,
  ptoAllowanceDays: null,
  isActive,
});

describe("splitTeams", () => {
  it("separates archived teams and sorts by handle", () => {
    const { active, archived } = splitTeams([
      team({ id: "1", handle: "eng" }),
      team({ id: "2", handle: "old", isActive: false }),
      team({ id: "3", handle: "design" }),
    ]);
    expect(active.map((t) => t.handle)).toEqual(["design", "eng"]);
    expect(archived.map((t) => t.handle)).toEqual(["old"]);
  });
});

describe("teamHandlesByUser", () => {
  it("maps users to their active team handles only", () => {
    const map = teamHandlesByUser([
      team({ id: "1", handle: "eng", memberIds: ["a", "b"] }),
      team({ id: "2", handle: "design", memberIds: ["a"] }),
      team({ id: "3", handle: "gone", isActive: false, memberIds: ["b"] }),
    ]);
    expect(map.get("a")).toEqual(["design", "eng"]);
    expect(map.get("b")).toEqual(["eng"]);
    expect(map.get("c")).toBeUndefined();
  });
});

describe("resolveMembers", () => {
  it("skips unknown ids and lists active people first by name", () => {
    const users = [user("a", "Zoe"), user("b", "Adam", false), user("c", "Mia")];
    expect(resolveMembers(["a", "b", "c", "zzz"], users).map((u) => u.fullName)).toEqual(["Mia", "Zoe", "Adam"]);
  });
});

describe("takenTeamChannels", () => {
  it("maps channels to other teams' handles", () => {
    const teams = [team({ id: "1", handle: "eng", slackChannelId: "C1" }), team({ id: "2", handle: "design", slackChannelId: "C2" })];
    const taken = takenTeamChannels(teams, "2");
    expect(taken.get("C1")).toBe("@eng");
    expect(taken.has("C2")).toBe(false);
  });
});

describe("syncSummary", () => {
  const tEn = createTranslator({ locale: "en", messages: en, namespace: "admin.directory" });
  const tUk = createTranslator({ locale: "uk", messages: uk, namespace: "admin.directory" });
  const full = {
    people: { created: 2, updated: 10 },
    teams: { created: 1, updated: 3, archived: 1, skippedMembers: 0 },
    teamsError: null,
  };

  it("shows people and teams", () => {
    expect(syncSummary(full, tEn)).toBe("Synced from Slack: 12 people (2 new) · 4 teams (1 archived).");
    expect(syncSummary(full, tUk)).toBe("Синхронізовано зі Slack: 12 людей (нових: 2) · 4 команди (в архіві: 1).");
  });

  it("shows people only when the team step failed", () => {
    const partial = { people: { created: 0, updated: 1 }, teams: null, teamsError: "failed" as const };
    expect(syncSummary(partial, tEn)).toBe("Synced from Slack: 1 person.");
    expect(syncSummary(partial, tUk)).toBe("Синхронізовано зі Slack: 1 людина.");
  });
});
