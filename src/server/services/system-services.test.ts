import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/queries/checkins", () => ({
  listCheckinRows: vi.fn(),
  listUserCheckinRows: vi.fn(),
  updateCheckinChannelTs: vi.fn(),
}));
vi.mock("@/server/db/queries/users", () => ({
  findActiveActorByAuthUserId: vi.fn(),
  findActiveProfileBySlackUserId: vi.fn(),
  upsertUserBySlackId: vi.fn(),
}));

import * as checkins from "@/server/db/queries/checkins";
import * as usersQ from "@/server/db/queries/users";
import { listCheckinsForDate, listCheckinsForUser, setCheckinChannelTs } from "./checkin-service";
import { ForbiddenError } from "./errors";
import { getActorBySlackUserId } from "./user-service";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkins.listCheckinRows).mockResolvedValue([]);
});

describe("checkin-service", () => {
  it("members read only their own check-in; managers read all", async () => {
    await listCheckinsForDate({ userId: ME, role: "member" }, "2026-11-27");
    expect(checkins.listCheckinRows).toHaveBeenLastCalledWith({}, "2026-11-27", ME);
    await listCheckinsForDate({ userId: ME, role: "manager" }, "2026-11-27");
    expect(checkins.listCheckinRows).toHaveBeenLastCalledWith({}, "2026-11-27", undefined);
  });

  it("listCheckinsForUser: member self only; manager anyone; bad dates throw", async () => {
    vi.mocked(checkins.listUserCheckinRows).mockResolvedValue([]);
    await expect(listCheckinsForUser({ userId: ME, role: "member" }, OTHER, "2026-11-01", "2026-11-30")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await listCheckinsForUser({ userId: ME, role: "manager" }, OTHER, "2026-11-01", "2026-11-30");
    expect(checkins.listUserCheckinRows).toHaveBeenLastCalledWith({}, OTHER, "2026-11-01", "2026-11-30");
    await expect(listCheckinsForUser({ userId: ME, role: "member" }, ME, "2026-11-31", "2026-12-01")).rejects.toBeInstanceOf(
      RangeError,
    );
  });

  it("setCheckinChannelTs writes the ts; malformed user id is a no-op", async () => {
    await setCheckinChannelTs(ME, "2026-11-27", "1732700000.000100");
    expect(checkins.updateCheckinChannelTs).toHaveBeenCalledWith({}, ME, "2026-11-27", "1732700000.000100");
    await setCheckinChannelTs("nope", "2026-11-27", "1.2");
    expect(checkins.updateCheckinChannelTs).toHaveBeenCalledTimes(1);
    await expect(setCheckinChannelTs(ME, "2026-02-30", "1.2")).rejects.toBeInstanceOf(RangeError);
  });
});

describe("getActorBySlackUserId", () => {
  it("returns the active profile or null", async () => {
    const profile = { userId: ME, role: "member" as const, slackUserId: "U1", fullName: "Ann", avatarUrl: null, timezone: "Europe/Kyiv", locale: "uk" as const };
    vi.mocked(usersQ.findActiveProfileBySlackUserId).mockResolvedValueOnce(profile).mockResolvedValueOnce(undefined);
    await expect(getActorBySlackUserId("U1")).resolves.toEqual(profile);
    await expect(getActorBySlackUserId("U2")).resolves.toBeNull();
    await expect(getActorBySlackUserId(" ")).resolves.toBeNull();
  });
});
