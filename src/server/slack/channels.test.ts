import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ getSlackClient: () => ({}) }));

import type { ConversationsClient } from "./channels";

const { listSlackChannels, joinSlackChannel, fetchChannelMemberSlackIds } = await import("./channels");

const platformError = (code: string) => Object.assign(new Error(`An API error occurred: ${code}`), { data: { ok: false, error: code } });

type Conv = ConversationsClient["conversations"];
function fakeClient(over: { list?: Conv["list"]; info?: Conv["info"]; join?: Conv["join"]; members?: Conv["members"] } = {}) {
  const conversations = {
    list: vi.fn<Conv["list"]>(over.list ?? (async () => ({ channels: [] }))),
    info: vi.fn<Conv["info"]>(over.info ?? (async () => ({ channel: { id: "C1", is_member: false, is_private: false } }))),
    join: vi.fn<Conv["join"]>(over.join ?? (async () => ({ ok: true }))),
    members: vi.fn<Conv["members"]>(over.members ?? (async () => ({ members: [] }))),
  };
  return { conversations };
}

describe("listSlackChannels", () => {
  it("follows cursors, maps membership and privacy, skips archived/nameless, sorts by name", async () => {
    const list = vi
      .fn<Conv["list"]>()
      .mockResolvedValueOnce({
        channels: [
          { id: "C2", name: "zeta", is_private: false, is_member: true },
          { id: "G1", name: "alpha-private", is_private: true, is_member: true },
          { id: "C9", name: "old", is_archived: true },
        ],
        response_metadata: { next_cursor: "c2" },
      })
      .mockResolvedValueOnce({ channels: [{ id: "C3", name: "dogteampro" }, { id: "C4" }], response_metadata: { next_cursor: "" } });
    const client = fakeClient({ list });
    expect(await listSlackChannels(client)).toEqual([
      { id: "G1", name: "alpha-private", isPrivate: true, isMember: true },
      { id: "C3", name: "dogteampro", isPrivate: false, isMember: false },
      { id: "C2", name: "zeta", isPrivate: false, isMember: true },
    ]);
    expect(list).toHaveBeenNthCalledWith(1, { types: "public_channel,private_channel", exclude_archived: true, limit: 1000 });
    expect(list).toHaveBeenNthCalledWith(2, { types: "public_channel,private_channel", exclude_archived: true, limit: 1000, cursor: "c2" });
  });
});

describe("joinSlackChannel", () => {
  it("already a member → ok without joining", async () => {
    const client = fakeClient({ info: async () => ({ channel: { is_member: true, is_private: true } }) });
    expect(await joinSlackChannel("G1", client)).toEqual({ ok: true });
    expect(client.conversations.join).not.toHaveBeenCalled();
  });

  it("public and not a member → conversations.join", async () => {
    const client = fakeClient();
    expect(await joinSlackChannel("C1", client)).toEqual({ ok: true });
    expect(client.conversations.join).toHaveBeenCalledWith({ channel: "C1" });
  });

  it("private and not a member → private_needs_invite, no join attempt", async () => {
    const client = fakeClient({ info: async () => ({ channel: { is_member: false, is_private: true } }) });
    expect(await joinSlackChannel("G2", client)).toMatchObject({ ok: false, reason: "private_needs_invite" });
    expect(client.conversations.join).not.toHaveBeenCalled();
  });

  it("join rejected for a private channel type → private_needs_invite", async () => {
    const client = fakeClient({ join: async () => Promise.reject(platformError("method_not_supported_for_channel_type")) });
    expect(await joinSlackChannel("C1", client)).toMatchObject({ ok: false, reason: "private_needs_invite" });
  });

  it("channel_not_found → not_found", async () => {
    const client = fakeClient({ info: async () => Promise.reject(platformError("channel_not_found")) });
    expect(await joinSlackChannel("C404", client)).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("other Slack errors → error with Slack's code in the message", async () => {
    const client = fakeClient({ join: async () => Promise.reject(platformError("missing_scope")) });
    const res = await joinSlackChannel("C1", client);
    expect(res).toMatchObject({ ok: false, reason: "error" });
    expect(res.ok === false && res.message).toContain("missing_scope");
  });
});

describe("fetchChannelMemberSlackIds", () => {
  it("follows cursors with limit 1000 and returns unique ids", async () => {
    const members = vi
      .fn<Conv["members"]>()
      .mockResolvedValueOnce({ members: ["U1", "U2"], response_metadata: { next_cursor: "n2" } })
      .mockResolvedValueOnce({ members: ["U2", "U3"], response_metadata: { next_cursor: "" } });
    const client = fakeClient({ members });
    expect(await fetchChannelMemberSlackIds("C1", client)).toEqual(["U1", "U2", "U3"]);
    expect(members).toHaveBeenNthCalledWith(1, { channel: "C1", limit: 1000 });
    expect(members).toHaveBeenNthCalledWith(2, { channel: "C1", limit: 1000, cursor: "n2" });
  });

  it.each(["channel_not_found", "not_in_channel"])("%s → [] and the code is logged", async (code) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = fakeClient({ members: async () => Promise.reject(platformError(code)) });
    expect(await fetchChannelMemberSlackIds("C404", client)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), "C404", code);
    warn.mockRestore();
  });

  it("other errors (e.g. rate limited) are thrown", async () => {
    const client = fakeClient({ members: async () => Promise.reject(platformError("ratelimited")) });
    await expect(fetchChannelMemberSlackIds("C1", client)).rejects.toThrow("ratelimited");
  });
});
