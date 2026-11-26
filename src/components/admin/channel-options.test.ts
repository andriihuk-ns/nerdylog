import { describe, expect, it } from "vitest";
import type { SlackChannelOption } from "@/contracts";
import { channelErrorCopy, channelLabel, filterChannels, findChannel, takenChannelMap } from "./channel-options";

const ch = (id: string, name: string, extra: Partial<SlackChannelOption> = {}): SlackChannelOption => ({
  id,
  name,
  isPrivate: false,
  isMember: true,
  ...extra,
});
const channels = [ch("C01AAAAAAAA", "dev-ops"), ch("C02BBBBBBBB", "dogteam"), ch("G03CCCCCCCC", "team-dog", { isPrivate: true })];

describe("takenChannelMap", () => {
  const projects = [
    { id: "p1", name: "DogTeamPro", slackChannelId: "C02BBBBBBBB" },
    { id: "p2", name: "Internal", slackChannelId: null },
    { id: "p3", name: "Ops", slackChannelId: "C01AAAAAAAA" },
  ];

  it("maps linked channels to project names and skips unlinked projects", () => {
    expect([...takenChannelMap(projects)]).toEqual([
      ["C02BBBBBBBB", "DogTeamPro"],
      ["C01AAAAAAAA", "Ops"],
    ]);
  });

  it("leaves out the project being edited so its own channel stays selectable", () => {
    const taken = takenChannelMap(projects, "p1");
    expect(taken.has("C02BBBBBBBB")).toBe(false);
    expect(taken.get("C01AAAAAAAA")).toBe("Ops");
  });
});

describe("filterChannels", () => {
  it("returns everything for an empty query", () => {
    expect(filterChannels(channels, "  ")).toBe(channels);
  });

  it("is case-insensitive, ignores a leading # and puts prefix matches first", () => {
    expect(filterChannels(channels, "#DOG").map((c) => c.name)).toEqual(["dogteam", "team-dog"]);
    expect(filterChannels(channels, "ops").map((c) => c.name)).toEqual(["dev-ops"]);
    expect(filterChannels(channels, "zzz")).toEqual([]);
  });
});

describe("findChannel / channelLabel", () => {
  it("finds by id and falls back to the raw id", () => {
    expect(findChannel(channels, "G03CCCCCCCC")?.name).toBe("team-dog");
    expect(findChannel(null, "G03CCCCCCCC")).toBeUndefined();
    expect(findChannel(channels, null)).toBeUndefined();
    expect(channelLabel(channels, "C02BBBBBBBB")).toBe("#dogteam");
    expect(channelLabel(channels, "C09ZZZZZZZZ")).toBe("C09ZZZZZZZZ");
  });
});

describe("channelErrorCopy", () => {
  it("names the invite fix for private channels", () => {
    expect(channelErrorCopy({ reason: "private_needs_invite", message: "x" }, "team-dog")).toEqual({
      kind: "privateInvite",
      channel: "team-dog",
    });
  });

  it("translates not-found and passes other messages through", () => {
    expect(channelErrorCopy({ reason: "not_found", message: "Channel not found" }, "x")).toEqual({ kind: "notFound" });
    expect(channelErrorCopy({ message: "This channel is already linked to another project" }, undefined)).toEqual({
      kind: "message",
      message: "This channel is already linked to another project",
    });
  });
});
