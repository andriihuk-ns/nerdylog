import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = { tx: true };
const db = { transaction: (fn: (t: unknown) => unknown) => fn(tx) };
vi.mock("@/server/db/client", () => ({ getDb: () => db }));
vi.mock("@/server/db/queries/teams", () => ({
  listTeamViews: vi.fn(),
  updateTeamChannelRow: vi.fn(),
  listTeamsForSync: vi.fn(),
  findUserIdsBySlackIds: vi.fn(),
  insertTeam: vi.fn(),
  updateTeamRow: vi.fn(),
  replaceTeamMembers: vi.fn(),
  listActiveTeamChannelsForUser: vi.fn(),
}));
vi.mock("./settings-service", () => ({ getStandupChannelId: vi.fn() }));

import * as q from "@/server/db/queries/teams";
import { ForbiddenError, InvalidInputError, NotFoundError } from "./errors";
import * as settings from "./settings-service";
import { listStandupChannelsForUser, listTeams, syncTeamsFromSlack, updateTeamChannel } from "./team-service";

const ID = "11111111-1111-4111-8111-111111111111";
const TEAM = "33333333-3333-4333-8333-333333333333";
const admin = { userId: ID, role: "admin" as const };
const manager = { userId: ID, role: "manager" as const };
const member = { userId: ID, role: "member" as const };
const view = {
  id: TEAM,
  slackUsergroupId: "S1",
  handle: "design",
  name: "Design",
  slackChannelId: "C0DESIGN01",
  isActive: true,
  memberIds: [ID],
};
const uniqueErr = (constraint: string) =>
  Object.assign(new Error("wrapped"), { cause: { code: "23505", constraint_name: constraint } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(q.listTeamViews).mockResolvedValue([view]);
  vi.mocked(q.updateTeamChannelRow).mockResolvedValue(view);
  vi.mocked(q.listTeamsForSync).mockResolvedValue([]);
  vi.mocked(q.findUserIdsBySlackIds).mockResolvedValue(new Map([["U1", ID]]));
  vi.mocked(q.insertTeam).mockResolvedValue(TEAM);
  vi.mocked(q.listActiveTeamChannelsForUser).mockResolvedValue([]);
  vi.mocked(settings.getStandupChannelId).mockResolvedValue("C0GENERAL1");
});

describe("listTeams", () => {
  it("manager/admin read; member forbidden", async () => {
    await expect(listTeams(member)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listTeams(manager)).resolves.toEqual([view]);
    expect(q.listTeamViews).toHaveBeenLastCalledWith(db, false);
    await listTeams(admin, { includeArchived: true });
    expect(q.listTeamViews).toHaveBeenLastCalledWith(db, true);
  });
});

describe("updateTeamChannel", () => {
  it("admin only", async () => {
    await expect(updateTeamChannel(manager, TEAM, "C0DESIGN01")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateTeamChannel(member, TEAM, null)).rejects.toBeInstanceOf(ForbiddenError);
    expect(q.updateTeamChannelRow).not.toHaveBeenCalled();
  });

  it("trims a valid channel; blank clears it", async () => {
    await expect(updateTeamChannel(admin, TEAM, " C0DESIGN01 ")).resolves.toEqual(view);
    expect(q.updateTeamChannelRow).toHaveBeenLastCalledWith(db, TEAM, "C0DESIGN01");
    await updateTeamChannel(admin, TEAM, "  ");
    expect(q.updateTeamChannelRow).toHaveBeenLastCalledWith(db, TEAM, null);
  });

  it("rejects a malformed channel id", async () => {
    await expect(updateTeamChannel(admin, TEAM, "general")).rejects.toBeInstanceOf(InvalidInputError);
    expect(q.updateTeamChannelRow).not.toHaveBeenCalled();
  });

  it("unknown or non-uuid team → NotFoundError", async () => {
    await expect(updateTeamChannel(admin, "nope", null)).rejects.toBeInstanceOf(NotFoundError);
    vi.mocked(q.updateTeamChannelRow).mockResolvedValue(undefined);
    await expect(updateTeamChannel(admin, TEAM, null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("channel already used by another team → field error", async () => {
    vi.mocked(q.updateTeamChannelRow).mockRejectedValue(uniqueErr("teams_slack_channel_id_unique"));
    const err = await updateTeamChannel(admin, TEAM, "C0DESIGN01").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect((err as InvalidInputError).fieldErrors).toEqual({
      slackChannelId: ["This channel is already linked to another team"],
    });
  });
});

describe("syncTeamsFromSlack", () => {
  const group = {
    slackUsergroupId: "S1",
    handle: "design",
    name: "Design",
    isActive: true,
    memberSlackIds: ["U1", "UX"],
    defaultChannelIds: [],
  };

  it("admin only", async () => {
    await expect(syncTeamsFromSlack(manager, [group])).rejects.toBeInstanceOf(ForbiddenError);
    expect(q.listTeamsForSync).not.toHaveBeenCalled();
  });

  it("invalid input fails before any query", async () => {
    await expect(syncTeamsFromSlack(admin, [{ ...group, slackUsergroupId: "" }])).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    expect(q.listTeamsForSync).not.toHaveBeenCalled();
  });

  it("applies the plan inside the transaction", async () => {
    vi.mocked(q.listTeamsForSync).mockResolvedValue([
      { id: "t-old", slackUsergroupId: "S0", handle: "old", name: "Old", isActive: true, memberIds: [] },
    ]);
    await expect(syncTeamsFromSlack(admin, [group])).resolves.toEqual({
      created: 1,
      updated: 0,
      archived: 1,
      skippedMembers: 1,
    });
    expect(q.findUserIdsBySlackIds).toHaveBeenCalledWith(tx, ["U1", "UX"]);
    expect(q.insertTeam).toHaveBeenCalledWith(tx, {
      slackUsergroupId: "S1",
      handle: "design",
      name: "Design",
      isActive: true,
    });
    expect(q.replaceTeamMembers).toHaveBeenCalledWith(tx, TEAM, [ID]);
    expect(q.updateTeamRow).toHaveBeenCalledWith(tx, "t-old", { isActive: false });
  });
});

describe("listStandupChannelsForUser", () => {
  it("returns the user's active team channels when any", async () => {
    vi.mocked(q.listActiveTeamChannelsForUser).mockResolvedValue(["C0DESIGN01", "C0ENG00001"]);
    await expect(listStandupChannelsForUser(ID)).resolves.toEqual(["C0DESIGN01", "C0ENG00001"]);
    expect(q.listActiveTeamChannelsForUser).toHaveBeenCalledWith(db, ID);
    expect(settings.getStandupChannelId).not.toHaveBeenCalled();
  });

  it("no team channel → general standup channel", async () => {
    await expect(listStandupChannelsForUser(ID)).resolves.toEqual(["C0GENERAL1"]);
  });

  it("no team channel and no general channel → []", async () => {
    vi.mocked(settings.getStandupChannelId).mockResolvedValue(null);
    await expect(listStandupChannelsForUser(ID)).resolves.toEqual([]);
  });

  it("non-uuid user id skips the team query and falls back", async () => {
    await expect(listStandupChannelsForUser("U123")).resolves.toEqual(["C0GENERAL1"]);
    expect(q.listActiveTeamChannelsForUser).not.toHaveBeenCalled();
  });
});
