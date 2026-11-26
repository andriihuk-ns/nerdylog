import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/queries/pings", () => ({
  listActivePingUsers: vi.fn(),
  listHolidayDates: vi.fn(),
  listOffDays: vi.fn(),
  claimPingRows: vi.fn(),
}));
vi.mock("@/server/db/queries/checkins", () => ({ listCheckinRows: vi.fn(), updateCheckinChannelTs: vi.fn() }));
vi.mock("@/server/db/queries/users", () => ({
  findActiveActorByAuthUserId: vi.fn(),
  findActiveProfileBySlackUserId: vi.fn(),
  upsertUserBySlackId: vi.fn(),
}));

import * as checkins from "@/server/db/queries/checkins";
import * as pings from "@/server/db/queries/pings";
import * as usersQ from "@/server/db/queries/users";
import { listCheckinsForDate, setCheckinChannelTs } from "./checkin-service";
import { claimMorningPings } from "./ping-service";
import { getActorBySlackUserId } from "./user-service";

const ME = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pings.listActivePingUsers).mockResolvedValue([
    { userId: "a", slackUserId: "UA", fullName: "Ann", timezone: "Europe/Kyiv" },
    { userId: "b", slackUserId: "UB", fullName: "Bob", timezone: "Europe/Kyiv" },
    { userId: "c", slackUserId: "UC", fullName: "Cid", timezone: "Europe/Kyiv" },
    { userId: "ny", slackUserId: "UN", fullName: "Nia", timezone: "America/New_York" },
  ]);
  vi.mocked(pings.listHolidayDates).mockResolvedValue([]);
  vi.mocked(pings.listOffDays).mockResolvedValue([{ userId: "c", workDate: "2026-11-30" }]);
  vi.mocked(pings.claimPingRows).mockResolvedValue(["a"]); // "b" was already claimed by an earlier run
  vi.mocked(checkins.listCheckinRows).mockResolvedValue([]);
});

describe("claimMorningPings", () => {
  it("claims in-window, non-PTO users and returns only newly claimed ones", async () => {
    const targets = await claimMorningPings(new Date("2026-11-30T07:30:00Z")); // Mon 09:30 Kyiv
    expect(pings.listOffDays).toHaveBeenCalledWith({}, ["a", "b", "c"], ["2026-11-30"]);
    expect(pings.listHolidayDates).toHaveBeenCalledWith({}, "2026-10-30", "2026-11-30");
    expect(pings.claimPingRows).toHaveBeenCalledWith({}, [
      { userId: "a", pingDate: "2026-11-30" },
      { userId: "b", pingDate: "2026-11-30" },
    ]);
    expect(targets).toEqual([
      { userId: "a", slackUserId: "UA", fullName: "Ann", timezone: "Europe/Kyiv", localDate: "2026-11-30", logDate: "2026-11-27" },
    ]);
  });

  it("does no further queries when nobody is in the window", async () => {
    await expect(claimMorningPings(new Date("2026-11-30T12:00:00Z"))).resolves.toEqual([]);
    expect(pings.listHolidayDates).not.toHaveBeenCalled();
    expect(pings.claimPingRows).not.toHaveBeenCalled();
  });

  it("skips everyone on a company holiday", async () => {
    vi.mocked(pings.listHolidayDates).mockResolvedValue(["2026-11-30"]);
    vi.mocked(pings.claimPingRows).mockResolvedValue([]);
    await expect(claimMorningPings(new Date("2026-11-30T07:30:00Z"))).resolves.toEqual([]);
    expect(pings.claimPingRows).toHaveBeenCalledWith({}, []);
  });
});

describe("checkin-service", () => {
  it("members read only their own check-in; managers read all", async () => {
    await listCheckinsForDate({ userId: ME, role: "member" }, "2026-11-27");
    expect(checkins.listCheckinRows).toHaveBeenLastCalledWith({}, "2026-11-27", ME);
    await listCheckinsForDate({ userId: ME, role: "manager" }, "2026-11-27");
    expect(checkins.listCheckinRows).toHaveBeenLastCalledWith({}, "2026-11-27", undefined);
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
    const profile = { userId: ME, role: "member" as const, slackUserId: "U1", fullName: "Ann", avatarUrl: null, timezone: "Europe/Kyiv" };
    vi.mocked(usersQ.findActiveProfileBySlackUserId).mockResolvedValueOnce(profile).mockResolvedValueOnce(undefined);
    await expect(getActorBySlackUserId("U1")).resolves.toEqual(profile);
    await expect(getActorBySlackUserId("U2")).resolves.toBeNull();
    await expect(getActorBySlackUserId(" ")).resolves.toBeNull();
  });
});
