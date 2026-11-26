/**
 * Rollups against real SQL (docs/02 "Rollup spec", A2 month-weeks, FR-WEB-03 caps).
 * Nov 2026: 1st is a Sunday → W1 1–1, W2 2–8, W3 9–15, W4 16–22, W5 23–29, W6 30–30.
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", async () => {
  const { activeTx } = await import("./db");
  return { getDb: () => activeTx(), closeDb: async () => {} };
});

import { describe, expect, it } from "vitest";
import type { RollupTotals, UserMonthRollup } from "@/contracts";
import type { Tx } from "@/server/db/queries/types";
import { dailyCheckins } from "@/server/db/schema";
import { getProjectCapUsage, getTeamMonthRollup } from "@/server/services/rollup-service";
import { withRollback } from "./db";
import { seedEntries, seedProject, seedUser } from "./fixtures";

const t = (hours: number, days: number, vacSick = 0, holidays = 0): RollupTotals => ({ hours, days, vacSick, holidays });

async function seedNovember(tx: Tx) {
  const alpha = await seedUser(tx, { fullName: "Alpha Tester", dailyNormHours: 8.0 });
  const bravo = await seedUser(tx, { fullName: "Bravo Tester", dailyNormHours: 6.0 });
  const gone = await seedUser(tx, { fullName: "Archived Tester", isActive: false });
  const p1 = await seedProject(tx);
  const p2 = await seedProject(tx);
  const A = alpha.id;
  const B = bravo.id;
  await seedEntries(tx, [
    { userId: A, date: "2026-10-31", hours: 5, projectId: p1 }, // previous month: ignored
    { userId: A, date: "2026-11-01", hours: 2, projectId: p1 }, // W1 (Sunday work counts)
    { userId: A, date: "2026-11-02", hours: 8, projectId: p1 }, // W2
    { userId: A, date: "2026-11-03", hours: 4, projectId: p1 },
    { userId: A, date: "2026-11-03", hours: 4, projectId: p2 },
    { userId: A, date: "2026-11-10", type: "vacation" }, // W3, duplicate PTO date → 1 day
    { userId: A, date: "2026-11-10", type: "vacation" },
    { userId: A, date: "2026-11-11", type: "sick" },
    { userId: A, date: "2026-11-16", type: "holiday" }, // W4
    { userId: A, date: "2026-11-17", hours: 7.5, projectId: p2 },
    { userId: A, date: "2026-11-30", hours: 6, projectId: p1 }, // W6
    { userId: A, date: "2026-12-01", hours: 8, projectId: p1 }, // next month: ignored
    { userId: B, date: "2026-11-05", hours: 6, projectId: p1 }, // W2
    { userId: B, date: "2026-11-16", type: "holiday" }, // W4
    { userId: B, date: "2026-11-24", hours: 3, projectId: p2 }, // W5
    { userId: B, date: "2026-11-25", type: "sick" },
    { userId: gone.id, date: "2026-11-05", hours: 8, projectId: p1 },
  ]);
  // Stream B noise that must not affect any total.
  await tx.insert(dailyCheckins).values({ userId: A, checkinDate: "2026-11-02", plannedToday: "DOG-1 8h", blockers: "12h" });
  return { alpha, bravo, gone };
}

const weekTotals = (row: UserMonthRollup) => row.weeks.map(({ hours, days, vacSick, holidays }) => t(hours, days, vacSick, holidays));

describe("getTeamMonthRollup (real SQL)", () => {
  it("manager sees all active users with month-week and month totals", async () => {
    await withRollback(async (tx) => {
      const { alpha, bravo, gone } = await seedNovember(tx);
      const fixtureIds = new Set([alpha.id, bravo.id, gone.id]);
      // The dev DB holds real users too: keep only the rows this fixture created (order preserved).
      const rows = (await getTeamMonthRollup({ userId: alpha.id, role: "manager" }, "2026-11")).filter((r) =>
        fixtureIds.has(r.userId),
      );
      expect(rows.map((r) => r.userId)).toEqual([alpha.id, bravo.id]); // archived user excluded, sorted by name

      const [a, b] = rows;
      expect(a.weeks.map((w) => [w.weekIndex, w.start, w.end])).toEqual([
        [1, "2026-11-01", "2026-11-01"],
        [2, "2026-11-02", "2026-11-08"],
        [3, "2026-11-09", "2026-11-15"],
        [4, "2026-11-16", "2026-11-22"],
        [5, "2026-11-23", "2026-11-29"],
        [6, "2026-11-30", "2026-11-30"],
      ]);
      expect(weekTotals(a)).toEqual([t(2, 0.25), t(16, 2), t(0, 0, 2), t(7.5, 0.9375, 0, 1), t(0, 0), t(6, 0.75)]);
      expect(a.total).toEqual(t(31.5, 3.9375, 2, 1));
      expect(a.dailyNormHours).toBe(8);

      expect(weekTotals(b)).toEqual([t(0, 0), t(6, 1), t(0, 0), t(0, 0, 0, 1), t(3, 0.5, 1), t(0, 0)]);
      expect(b.total).toEqual(t(9, 1.5, 1, 1));
      expect(b.dailyNormHours).toBe(6);
    });
  });

  it("member sees only their own row", async () => {
    await withRollback(async (tx) => {
      const { bravo } = await seedNovember(tx);
      const rows = await getTeamMonthRollup({ userId: bravo.id, role: "member" }, "2026-11");
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(bravo.id);
      expect(rows[0].total).toEqual(t(9, 1.5, 1, 1));
    });
  });

  it("an archived member gets an empty rollup", async () => {
    await withRollback(async (tx) => {
      const { gone } = await seedNovember(tx);
      expect(await getTeamMonthRollup({ userId: gone.id, role: "member" }, "2026-11")).toEqual([]);
    });
  });
});

describe("getProjectCapUsage (real SQL)", () => {
  async function seedCaps(tx: Tx) {
    const a = await seedUser(tx, { fullName: "Alpha Tester" });
    const b = await seedUser(tx, { fullName: "Bravo Tester" });
    const p84 = await seedProject(tx, { name: "Cap 84", cap: 100 });
    const p85 = await seedProject(tx, { name: "Cap 85", cap: 100 });
    const p100 = await seedProject(tx, { name: "Cap 100", cap: 40 });
    const free = await seedProject(tx, { name: "No Cap", cap: null });
    const day = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;
    await seedEntries(tx, [
      ...[24, 24, 24, 12].map((hours, i) => ({ userId: a.id, date: day(i + 2), hours, projectId: p84 })),
      ...[24, 24, 24].map((hours, i) => ({ userId: a.id, date: day(i + 9), hours, projectId: p85 })),
      { userId: b.id, date: day(12), hours: 13, projectId: p85 },
      { userId: a.id, date: day(16), hours: 24, projectId: p100 },
      { userId: a.id, date: day(17), hours: 16, projectId: p100 },
      { userId: a.id, date: "2026-12-01", hours: 24, projectId: p100 }, // next month: ignored
      { userId: a.id, date: day(18), hours: 5, projectId: free },
      { userId: a.id, date: day(19), type: "vacation" }, // PTO never counts against caps
    ]);
    return { a, b, p84, p85, p100, free };
  }

  it("manager: 84% neutral, 85% warning, 100% over, no cap neutral", async () => {
    await withRollback(async (tx) => {
      const s = await seedCaps(tx);
      const usage = await getProjectCapUsage({ userId: s.a.id, role: "manager" }, "2026-11");
      const byId = new Map(usage.map((u) => [u.projectId, u]));
      expect(usage).toHaveLength(4);
      expect(byId.get(s.p84)).toMatchObject({ usedHours: 84, capHours: 100, status: "neutral", month: "2026-11" });
      expect(byId.get(s.p85)).toMatchObject({ usedHours: 85, capHours: 100, status: "warning" });
      expect(byId.get(s.p100)).toMatchObject({ usedHours: 40, capHours: 40, status: "over" });
      expect(byId.get(s.free)).toMatchObject({ usedHours: 5, capHours: null, status: "neutral" });
    });
  });

  it("member: only projects they logged, with team-wide usedHours", async () => {
    await withRollback(async (tx) => {
      const s = await seedCaps(tx);
      const usage = await getProjectCapUsage({ userId: s.b.id, role: "member" }, "2026-11");
      expect(usage).toEqual([
        { projectId: s.p85, projectName: "Cap 85", month: "2026-11", usedHours: 85, capHours: 100, status: "warning" },
      ]);
    });
  });
});
