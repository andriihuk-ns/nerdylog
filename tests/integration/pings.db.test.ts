/**
 * claimMorningPings against real SQL (A4 dedup, A10 window [09:30, 11:00) local weekday,
 * no company holiday, no PTO that local day). 2026-11-26 is a Thursday; Kyiv is UTC+2 in November.
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", async () => {
  const { activeTx } = await import("./db");
  return { getDb: () => activeTx(), closeDb: async () => {} };
});

import { describe, expect, it } from "vitest";
import { dailyPings } from "@/server/db/schema";
import { claimMorningPings } from "@/server/services/ping-service";
import { withRollback } from "./db";
import { seedEntries, seedHoliday, seedUser } from "./fixtures";

const KYIV_10_00 = new Date("2026-11-26T08:00:00Z");

describe("claimMorningPings (A10)", () => {
  it("Kyiv user at 10:00 local on a weekday is claimed once; a second run returns nothing", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx, { timezone: "Europe/Kyiv" });
      const first = await claimMorningPings(KYIV_10_00);
      expect(first).toEqual([
        {
          userId: u.id,
          slackUserId: u.slackUserId,
          fullName: expect.any(String),
          timezone: "Europe/Kyiv",
          localDate: "2026-11-26",
          logDate: "2026-11-25",
        },
      ]);
      expect(await claimMorningPings(KYIV_10_00)).toEqual([]);
      expect(await claimMorningPings(new Date("2026-11-26T08:45:00Z"))).toEqual([]); // later run, same day
      expect(await tx.$count(dailyPings)).toBe(1);
    });
  });

  it("user on vacation that day is not claimed; colleague is", async () => {
    await withRollback(async (tx) => {
      const away = await seedUser(tx);
      const here = await seedUser(tx);
      await seedEntries(tx, [{ userId: away.id, date: "2026-11-26", type: "vacation" }]);
      const claimed = await claimMorningPings(KYIV_10_00);
      expect(claimed.map((c) => c.userId)).toEqual([here.id]);
    });
  });

  it("company holiday that day → nobody is claimed and no daily_pings rows are written", async () => {
    await withRollback(async (tx) => {
      await seedUser(tx);
      await seedHoliday(tx, "2026-11-26");
      expect(await claimMorningPings(KYIV_10_00)).toEqual([]);
      expect(await tx.$count(dailyPings)).toBe(0);
    });
  });

  it("outside the window, on a weekend, for archived users, or in another timezone → not claimed", async () => {
    await withRollback(async (tx) => {
      await seedUser(tx, { isActive: false });
      await seedUser(tx, { timezone: "America/New_York" }); // 03:00 local at KYIV_10_00
      expect(await claimMorningPings(KYIV_10_00)).toEqual([]);
      await seedUser(tx);
      expect(await claimMorningPings(new Date("2026-11-26T07:29:59Z"))).toEqual([]); // 09:29:59
      expect(await claimMorningPings(new Date("2026-11-26T09:00:00Z"))).toEqual([]); // 11:00:00 exclusive
      expect(await claimMorningPings(new Date("2026-11-28T08:00:00Z"))).toEqual([]); // Saturday
      expect(await tx.$count(dailyPings)).toBe(0);
    });
  });

  it("Monday ping logs the previous Friday, skipping a Friday holiday", async () => {
    await withRollback(async (tx) => {
      await seedUser(tx);
      await seedHoliday(tx, "2026-11-27");
      const [target] = await claimMorningPings(new Date("2026-11-30T08:00:00Z"));
      expect(target).toMatchObject({ localDate: "2026-11-30", logDate: "2026-11-26" });
    });
  });
});
