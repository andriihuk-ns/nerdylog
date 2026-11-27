/**
 * claimMorningPings against real SQL (A4 dedup, A10 window [09:30, 11:00) local weekday,
 * no holiday of the user's own office (A15), no PTO that local day). 2026-11-26 is a Thursday; Kyiv is UTC+2 in November.
 * The dev DB holds real users too, so every assertion is scoped to the ids this test seeded.
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", async () => {
  const { activeTx } = await import("./db");
  return { getDb: () => activeTx(), closeDb: async () => {} };
});

import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/queries/types";
import { dailyPings } from "@/server/db/schema";
import { claimMorningPings } from "@/server/services/ping-service";
import { withRollback } from "./db";
import { seedEntries, seedHoliday, seedOffice, seedUser, type SeededUser } from "./fixtures";

const KYIV_10_00 = new Date("2026-11-26T08:00:00Z");

/** Claim, then keep only the targets for the given fixture users. */
async function claimFor(users: readonly SeededUser[], now: Date) {
  const ids = new Set(users.map((u) => u.id));
  return (await claimMorningPings(now)).filter((c) => ids.has(c.userId));
}
const pingsOf = (tx: Tx, users: readonly SeededUser[]) =>
  tx.$count(dailyPings, inArray(dailyPings.userId, users.map((u) => u.id)));

describe("claimMorningPings (A10)", () => {
  it("Kyiv user at 10:00 local on a weekday is claimed once; a second run returns nothing", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx, { timezone: "Europe/Kyiv" });
      const first = await claimFor([u], KYIV_10_00);
      expect(first).toEqual([
        {
          userId: u.id,
          slackUserId: u.slackUserId,
          fullName: expect.any(String),
          locale: "uk",
          timezone: "Europe/Kyiv",
          localDate: "2026-11-26",
          logDate: "2026-11-25",
        },
      ]);
      expect(await claimFor([u], KYIV_10_00)).toEqual([]);
      expect(await claimFor([u], new Date("2026-11-26T08:45:00Z"))).toEqual([]); // later run, same day
      expect(await pingsOf(tx, [u])).toBe(1);
    });
  });

  it("user on vacation that day is not claimed; colleague is", async () => {
    await withRollback(async (tx) => {
      const away = await seedUser(tx);
      const here = await seedUser(tx);
      await seedEntries(tx, [{ userId: away.id, date: "2026-11-26", type: "vacation" }]);
      const claimed = await claimFor([away, here], KYIV_10_00);
      expect(claimed.map((c) => c.userId)).toEqual([here.id]);
    });
  });

  it("holiday of the user's own office → not claimed; other office and no-office users are (A15)", async () => {
    await withRollback(async (tx) => {
      const officeA = await seedOffice(tx);
      const officeB = await seedOffice(tx);
      await seedHoliday(tx, officeA, "2026-11-26");
      const off = await seedUser(tx, { officeId: officeA });
      const other = await seedUser(tx, { officeId: officeB });
      const none = await seedUser(tx, { officeId: null });
      const claimed = await claimFor([off, other, none], KYIV_10_00);
      expect(claimed.map((c) => c.userId).sort()).toEqual([other.id, none.id].sort());
      expect(await pingsOf(tx, [off])).toBe(0);
    });
  });

  it("outside the window, on a weekend, for archived users, or in another timezone → not claimed", async () => {
    await withRollback(async (tx) => {
      const archived = await seedUser(tx, { isActive: false });
      const ny = await seedUser(tx, { timezone: "America/New_York" }); // 03:00 local at KYIV_10_00
      expect(await claimFor([archived, ny], KYIV_10_00)).toEqual([]);
      const kyiv = await seedUser(tx);
      const all = [archived, ny, kyiv];
      expect(await claimFor(all, new Date("2026-11-26T07:29:59Z"))).toEqual([]); // 09:29:59
      expect(await claimFor(all, new Date("2026-11-26T09:00:00Z"))).toEqual([]); // 11:00:00 exclusive
      expect(await claimFor(all, new Date("2026-11-28T08:00:00Z"))).toEqual([]); // Saturday
      expect(await pingsOf(tx, all)).toBe(0);
    });
  });

  it("Monday ping logs the previous Friday, skipping a Friday holiday of the user's office only", async () => {
    await withRollback(async (tx) => {
      const office = await seedOffice(tx);
      await seedHoliday(tx, office, "2026-11-27");
      const u = await seedUser(tx, { officeId: office });
      const elsewhere = await seedUser(tx, { officeId: null });
      const targets = await claimFor([u, elsewhere], new Date("2026-11-30T08:00:00Z"));
      const byId = new Map(targets.map((t) => [t.userId, t]));
      expect(byId.get(u.id)).toMatchObject({ localDate: "2026-11-30", logDate: "2026-11-26" });
      expect(byId.get(elsewhere.id)).toMatchObject({ localDate: "2026-11-30", logDate: "2026-11-27" });
    });
  });
});
