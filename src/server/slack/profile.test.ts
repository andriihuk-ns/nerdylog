import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  getSlackClient: () => {
    throw new Error("no default client in tests");
  },
}));

const { fetchSlackTitle, fetchSlackTitleWithTimeout } = await import("./profile");

function fakeClient(info: (args: { user: string }) => Promise<unknown>) {
  return { users: { info: vi.fn(info) } } as unknown as Parameters<typeof fetchSlackTitle>[1] & {
    users: { info: ReturnType<typeof vi.fn> };
  };
}

describe("fetchSlackTitle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the trimmed profile title", async () => {
    const client = fakeClient(async () => ({ user: { profile: { title: "  Product Designer " } } }));
    await expect(fetchSlackTitle("U1", client)).resolves.toBe("Product Designer");
    expect(client.users.info).toHaveBeenCalledWith({ user: "U1" });
  });

  it.each([["blank", { user: { profile: { title: "   " } } }], ["missing", { user: {} }], ["no user", {}]])(
    "returns null for a %s title",
    async (_label, res) => {
      await expect(fetchSlackTitle("U1", fakeClient(async () => res))).resolves.toBeNull();
    },
  );

  it("returns null and logs only the Slack error code on failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = Object.assign(new Error("An API error occurred: user_not_found"), {
      code: "slack_webapi_platform_error",
      data: { ok: false, error: "user_not_found" },
    });
    await expect(fetchSlackTitle("U1", fakeClient(async () => Promise.reject(err)))).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith("slack/profile: users.info failed", "user_not_found");
  });

  it("returns null when the default client cannot be created", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchSlackTitle("U1")).resolves.toBeNull();
  });
});

describe("fetchSlackTitleWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the title when Slack answers in time", async () => {
    const client = fakeClient(async () => ({ user: { profile: { title: "Engineer" } } }));
    await expect(fetchSlackTitleWithTimeout("U1", 2000, client)).resolves.toBe("Engineer");
  });

  it("resolves null when Slack is slower than the cap", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = fakeClient(() => new Promise(() => {}));
    const pending = fetchSlackTitleWithTimeout("U1", 2000, client);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toBeNull();
  });
});
