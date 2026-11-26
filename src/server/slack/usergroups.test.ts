import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ getSlackClient: () => ({}) }));

import type { UsergroupsClient } from "./usergroups";

const { fetchSlackUsergroups } = await import("./usergroups");

type UG = UsergroupsClient["usergroups"];
function fakeClient(groups: Awaited<ReturnType<UG["list"]>>["usergroups"], users: Record<string, string[]> = {}) {
  const list = vi.fn<UG["list"]>(async () => ({ usergroups: groups }));
  const usersList = vi.fn<UG["users"]["list"]>(async ({ usergroup }) => ({ users: users[usergroup] ?? [] }));
  return { client: { usergroups: { list, users: { list: usersList } } }, list, usersList };
}

describe("fetchSlackUsergroups", () => {
  it("maps an active group with users and default channels", async () => {
    const { client, list, usersList } = fakeClient([
      { id: "S1", handle: "design", name: "Design", date_delete: 0, users: ["U1", "U2"], prefs: { channels: ["C1", "C2"] } },
    ]);
    expect(await fetchSlackUsergroups(client)).toEqual([
      { slackUsergroupId: "S1", handle: "design", name: "Design", isActive: true, memberSlackIds: ["U1", "U2"], defaultChannelIds: ["C1", "C2"] },
    ]);
    expect(list).toHaveBeenCalledWith({ include_disabled: true, include_users: true });
    expect(usersList).not.toHaveBeenCalled();
  });

  it("marks a disabled group (date_delete > 0) inactive and strips a leading @", async () => {
    const { client } = fakeClient([{ id: "S2", handle: "@old", name: "Old", date_delete: 1700000000, users: ["U3"] }]);
    expect(await fetchSlackUsergroups(client)).toMatchObject([{ slackUsergroupId: "S2", handle: "old", isActive: false, memberSlackIds: ["U3"] }]);
  });

  it("falls back to usergroups.users.list when users is missing", async () => {
    const { client, usersList } = fakeClient([{ id: "S3", handle: "qa", name: "QA", date_delete: 0 }], { S3: ["U7", "U8"] });
    expect(await fetchSlackUsergroups(client)).toMatchObject([{ slackUsergroupId: "S3", memberSlackIds: ["U7", "U8"] }]);
    expect(usersList).toHaveBeenCalledWith({ usergroup: "S3", include_disabled: true });
  });

  it("no prefs → no default channels; groups without an id are skipped", async () => {
    const { client } = fakeClient([{ id: "S4", handle: "ops", name: "Ops", users: [] }, { handle: "ghost" }]);
    expect(await fetchSlackUsergroups(client)).toEqual([
      { slackUsergroupId: "S4", handle: "ops", name: "Ops", isActive: true, memberSlackIds: [], defaultChannelIds: [] },
    ]);
  });
});
