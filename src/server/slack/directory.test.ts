import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ getSlackClient: () => ({}) }));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ CRON_SECRET: "x".repeat(16) }) }));

const { fetchSlackDirectory } = await import("./directory");
const { hasBearer } = await import("./route-helpers");

describe("fetchSlackDirectory", () => {
  it("follows cursors and filters non-people", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ members: [{ id: "U1", real_name: "A", profile: { title: "Engineer" } }, { id: "B1", is_bot: true }], response_metadata: { next_cursor: "c2" } })
      .mockResolvedValueOnce({ members: [{ id: "U2", real_name: "B" }], response_metadata: { next_cursor: "" } });
    const members = await fetchSlackDirectory({ users: { list } });
    expect(members.map((m) => m.slackUserId)).toEqual(["U1", "U2"]);
    expect(list).toHaveBeenNthCalledWith(2, { limit: 200, cursor: "c2" });
    expect(members.map((m) => m.title)).toEqual(["Engineer", null]);
  });
});

describe("hasBearer", () => {
  it("accepts only the exact bearer secret", () => {
    const secret = "s".repeat(32);
    expect(hasBearer(`Bearer ${secret}`, secret)).toBe(true);
    expect(hasBearer(`Bearer ${secret}x`, secret)).toBe(false);
    expect(hasBearer(secret, secret)).toBe(false);
    expect(hasBearer(null, secret)).toBe(false);
  });
});
