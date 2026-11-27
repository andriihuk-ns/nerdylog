import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/server/db/queries/pings", () => ({
  listActivePingUsers: vi.fn(),
  listOffDays: vi.fn(),
  claimPingRows: vi.fn(),
}));
vi.mock("@/server/db/queries/catalog", () => ({ listOfficeHolidayDates: vi.fn() }));
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

import * as catalog from "@/server/db/queries/catalog";
import * as checkins from "@/server/db/queries/checkins";
import * as pings from "@/server/db/queries/pings";
import * as usersQ from "@/server/db/queries/users";
import { listCheckinsForDate, listCheckinsForUser, setCheckinChannelTs } from "./checkin-service";
import { ForbiddenError } from "./errors";
import { claimMorningPings } from "./ping-service";
import { getActorBySlackUserId } from "./user-service";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pings.listActivePingUsers).mockResolvedValue([
    { userId: "a", slackUserId: "UA", fullName: "Ann", timezone: "Europe/Kyiv", locale: "en", officeId: "ua" },
    { userId: "b", slackUserId: "UB", fullName: "Bob", timezone: "Europe/Kyiv", locale: "uk", officeId: "pl" },
    { userId: "c", slackUserId: "UC", fullName: "Cid", timezone: "Europe/Kyiv", locale: "uk", officeId: null },
    { userId: "ny", slackUserId: "UN", fullName: "Nia", timezone: "America/New_York", locale: "uk", officeId: "ua" },
  ]);
  vi.mocked(catalog.listOfficeHolidayDates).mockResolvedValue([]);
  vi.mocked(pings.listOffDays).mockResolvedValue([{ userId: "c", workDate: "2026-11-30" }]);
  vi.mocked(pings.claimPingRows).mockResolvedValue(["a"]); // "b" was already claimed by an earlier run
  vi.mocked(checkins.listCheckinRows).mockResolvedValue([]);
});

describe("claimMorningPings", () => {
  it("claims in-window, non-PTO users and returns only newly claimed ones", async () => {
    const targets = await claimMorningPings(new Date("2026-11-30T07:30:00Z")); // Mon 09:30 Kyiv
    expect(pings.listOffDays).toHaveBeenCalledWith({}, ["a", "b", "c"], ["2026-11-30"]);
    expect(catalog.listOfficeHolidayDates).toHaveBeenCalledWith({}, ["ua", "pl"], "2026-10-30", "2026-11-30");
    expect(pings.claimPingRows).toHaveBeenCalledWith({}, [
      { userId: "a", pingDate: "2026-11-30" },
      { userId: "b", pingDate: "2026-11-30" },
    ]);
    expect(targets).toEqual([
      { userId: "a", slackUserId: "UA", fullName: "Ann", locale: "en", timezone: "Europe/Kyiv", localDate: "2026-11-30", logDate: "2026-11-27" },
    ]);
  });

  it("does no further queries when nobody is in the window", async () => {
    await expect(claimMorningPings(new Date("2026-11-30T12:00:00Z"))).resolves.toEqual([]);
    expect(catalog.listOfficeHolidayDates).not.toHaveBeenCalled();
    expect(pings.claimPingRows).not.toHaveBeenCalled();
  });

  it("skips only users whose own office has a holiday that day (A15)", async () => {
    vi.mocked(catalog.listOfficeHolidayDates).mockResolvedValue([{ officeId: "ua", date: "2026-11-30" }]);
    vi.mocked(pings.listOffDays).mockResolvedValue([]);
    vi.mocked(pings.claimPingRows).mockResolvedValue([]);
    await claimMorningPings(new Date("2026-11-30T07:30:00Z"));
    // "a" (UA) is off; "b" (PL) and "c" (no office → no holidays) are still pinged.
    expect(pings.claimPingRows).toHaveBeenCalledWith({}, [
      { userId: "b", pingDate: "2026-11-30" },
      { userId: "c", pingDate: "2026-11-30" },
    ]);
  });

  it("logDate skips the user's own office holidays only", async () => {
    vi.mocked(catalog.listOfficeHolidayDates).mockResolvedValue([{ officeId: "pl", date: "2026-11-27" }]);
    vi.mocked(pings.listOffDays).mockResolvedValue([]);
    vi.mocked(pings.claimPingRows).mockResolvedValue(["a", "b"]);
    const targets = await claimMorningPings(new Date("2026-11-30T07:30:00Z"));
    expect(targets.map((t) => [t.userId, t.logDate])).toEqual([
      ["a", "2026-11-27"],
      ["b", "2026-11-26"],
    ]);
  });
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
