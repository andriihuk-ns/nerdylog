import { describe, expect, it } from "vitest";
import type { SlackUsergroup } from "@/contracts";
import type { ExistingTeam } from "@/server/db/queries/teams";
import { InvalidInputError } from "./errors";
import { memberSlackIdsOf, parseUsergroups, planTeamSync } from "./team-sync";

const users = new Map([
  ["U1", "u-1"],
  ["U2", "u-2"],
  ["U3", "u-3"],
]);

function group(over: Partial<SlackUsergroup> = {}): SlackUsergroup {
  return {
    slackUsergroupId: "S1",
    handle: "design",
    name: "Design",
    isActive: true,
    memberSlackIds: ["U1", "U2"],
    defaultChannelIds: ["C0DESIGN01"],
    ...over,
  };
}

function team(over: Partial<ExistingTeam> = {}): ExistingTeam {
  return {
    id: "t-1",
    slackUsergroupId: "S1",
    handle: "design",
    name: "Design",
    isActive: true,
    memberIds: ["u-1", "u-2"],
    ...over,
  };
}

const plan = (groups: SlackUsergroup[], existing: ExistingTeam[] = []) =>
  planTeamSync(parseUsergroups(groups), existing, users);

describe("parseUsergroups", () => {
  it("trims, strips a leading @ from the handle, last duplicate wins", () => {
    const out = parseUsergroups([
      group({ slackUsergroupId: " S1 ", handle: "@old" }),
      group({ handle: " @design ", memberSlackIds: [" U1 "] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ slackUsergroupId: "S1", handle: "design", memberSlackIds: ["U1"] });
  });

  it("rejects a blank group id", () => {
    expect(() => parseUsergroups([group({ slackUsergroupId: "  " })])).toThrow(InvalidInputError);
  });
});

describe("planTeamSync", () => {
  it("creates new groups with their known members", () => {
    const p = plan([group()]);
    expect(p.creates).toEqual([
      {
        values: { slackUsergroupId: "S1", handle: "design", name: "Design", isActive: true },
        memberIds: ["u-1", "u-2"],
      },
    ]);
    expect(p.counts).toEqual({ created: 1, updated: 0, archived: 0, skippedMembers: 0 });
  });

  it("blank name falls back to the handle", () => {
    expect(plan([group({ name: " " })]).creates[0].values.name).toBe("design");
  });

  it("an unchanged team produces no writes", () => {
    const p = plan([group({ memberSlackIds: ["U2", "U1"] })], [team()]);
    expect(p.updates).toEqual([]);
    expect(p.archiveIds).toEqual([]);
    expect(p.counts).toEqual({ created: 0, updated: 0, archived: 0, skippedMembers: 0 });
  });

  it("rename and handle change update only the changed fields", () => {
    const p = plan([group({ handle: "ux", name: "UX" })], [team()]);
    expect(p.updates).toEqual([{ teamId: "t-1", set: { handle: "ux", name: "UX" }, memberIds: null }]);
    expect(p.counts.updated).toBe(1);
  });

  it("replaces membership when the member set differs", () => {
    const p = plan([group({ memberSlackIds: ["U3", "U1"] })], [team()]);
    expect(p.updates).toEqual([{ teamId: "t-1", set: {}, memberIds: ["u-1", "u-3"] }]);
    expect(p.counts.updated).toBe(1);
  });

  it("an emptied active group replaces membership with nothing", () => {
    const p = plan([group({ memberSlackIds: [] })], [team()]);
    expect(p.updates[0].memberIds).toEqual([]);
  });

  it("skips and counts unknown Slack ids once per group, dedupes members", () => {
    const p = plan([
      group({ memberSlackIds: ["U1", "UX", "UX", "U1", "UY", ""] }),
      group({ slackUsergroupId: "S2", handle: "eng", name: "Eng", memberSlackIds: ["UX"] }),
    ]);
    expect(p.creates[0].memberIds).toEqual(["u-1"]);
    expect(p.creates[1].memberIds).toEqual([]);
    expect(p.counts.skippedMembers).toBe(3);
  });

  it("a team missing from the input becomes inactive; already inactive is left alone", () => {
    const p = plan(
      [],
      [team(), team({ id: "t-2", slackUsergroupId: "S2", isActive: false })],
    );
    expect(p.archiveIds).toEqual(["t-1"]);
    expect(p.updates).toEqual([]);
    expect(p.counts).toEqual({ created: 0, updated: 0, archived: 1, skippedMembers: 0 });
  });

  it("a disabled group archives the team and keeps its membership", () => {
    const p = plan([group({ isActive: false, memberSlackIds: [] })], [team()]);
    expect(p.updates).toEqual([{ teamId: "t-1", set: { isActive: false }, memberIds: null }]);
    expect(p.counts).toEqual({ created: 0, updated: 0, archived: 1, skippedMembers: 0 });
  });

  it("a disabled group that is new is created inactive without members", () => {
    const p = plan([group({ isActive: false })]);
    expect(p.creates).toEqual([
      { values: { slackUsergroupId: "S1", handle: "design", name: "Design", isActive: false }, memberIds: [] },
    ]);
    expect(p.counts.created).toBe(1);
    expect(p.counts.skippedMembers).toBe(0);
  });

  it("a re-enabled group reactivates the team and counts as updated", () => {
    const p = plan([group()], [team({ isActive: false, memberIds: [] })]);
    expect(p.updates).toEqual([{ teamId: "t-1", set: { isActive: true }, memberIds: ["u-1", "u-2"] }]);
    expect(p.counts).toEqual({ created: 0, updated: 1, archived: 0, skippedMembers: 0 });
  });

  it("never plans a slack_channel_id write", () => {
    const p = plan(
      [group({ handle: "ux", isActive: false }), group({ slackUsergroupId: "S9", defaultChannelIds: ["C0NEW00001"] })],
      [team()],
    );
    const sets = [...p.creates.map((c) => c.values), ...p.updates.map((u) => u.set)];
    for (const s of sets) expect(s).not.toHaveProperty("slackChannelId");
  });
});

describe("memberSlackIdsOf", () => {
  it("collects distinct ids of active groups only", () => {
    const ids = memberSlackIdsOf(
      parseUsergroups([
        group({ memberSlackIds: ["U1", "U2"] }),
        group({ slackUsergroupId: "S2", memberSlackIds: ["U2", "U3"] }),
        group({ slackUsergroupId: "S3", isActive: false, memberSlackIds: ["U9"] }),
      ]),
    );
    expect(ids.sort()).toEqual(["U1", "U2", "U3"]);
  });
});
