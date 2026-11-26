/**
 * DB constraints (PRD A6, A8, A9, A11): drizzle/0000_init.sql, 0002, 0003.
 * Each violating statement runs in a savepoint so the test transaction stays usable.
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/queries/types";
import { dailyCheckins, projects, timeEntries, users } from "@/server/db/schema";
import { expectPgFailure, withRollback } from "./db";
import { seedProject, seedUser } from "./fixtures";

const CHECK = "23514";
const UNIQUE = "23505";

const entry = (tx: Tx, values: Partial<typeof timeEntries.$inferInsert> & { userId: string }) =>
  tx.insert(timeEntries).values({ workDate: "2026-11-02", hours: 0, entryType: "work", source: "web_ui", ...values });

describe("time_entries checks (A8)", () => {
  it("hours must be within 0..24", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const p = await seedProject(tx);
      await expectPgFailure(tx, (sp) => entry(sp, { userId: u.id, projectId: p, hours: 24.25 }), CHECK, "time_entries_hours_range");
      await expectPgFailure(tx, (sp) => entry(sp, { userId: u.id, projectId: p, hours: -1 }), CHECK, "time_entries_hours_range");
      await entry(tx, { userId: u.id, projectId: p, hours: 24 });
      await entry(tx, { userId: u.id, projectId: p, hours: 0 });
      await entry(tx, { userId: u.id, projectId: p, hours: 2.5 });
      expect(await tx.$count(timeEntries)).toBe(3);
    });
  });

  it("work rows need a project", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      await expectPgFailure(tx, (sp) => entry(sp, { userId: u.id, projectId: null, hours: 4 }), CHECK, "time_entries_work_has_project");
    });
  });

  it.each(["vacation", "sick", "holiday"] as const)("%s rows carry 0 hours and need no project", async (type) => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      await expectPgFailure(tx, (sp) => entry(sp, { userId: u.id, entryType: type, hours: 8 }), CHECK, "time_entries_pto_zero_hours");
      await entry(tx, { userId: u.id, entryType: type, hours: 0 });
      expect(await tx.$count(timeEntries)).toBe(1);
    });
  });

  it("slack_view_id is NOT unique: one modal writes several rows (A1)", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const p = await seedProject(tx);
      await entry(tx, { userId: u.id, projectId: p, hours: 2, slackViewId: "VTEST_MULTI" });
      await entry(tx, { userId: u.id, projectId: p, hours: 3, slackViewId: "VTEST_MULTI" });
      expect(await tx.$count(timeEntries, eq(timeEntries.slackViewId, "VTEST_MULTI"))).toBe(2);
    });
  });
});

describe("daily_checkins unique (user, date) (A6)", () => {
  it("rejects a second check-in for the same user and date; other dates/users are fine", async () => {
    await withRollback(async (tx) => {
      const a = await seedUser(tx);
      const b = await seedUser(tx);
      await tx.insert(dailyCheckins).values({ userId: a.id, checkinDate: "2026-11-02" });
      await expectPgFailure(
        tx,
        (sp) => sp.insert(dailyCheckins).values({ userId: a.id, checkinDate: "2026-11-02" }),
        UNIQUE,
        "daily_checkins_user_date_uq",
      );
      await tx.insert(dailyCheckins).values([
        { userId: a.id, checkinDate: "2026-11-03" },
        { userId: b.id, checkinDate: "2026-11-02" },
      ]);
      expect(await tx.$count(dailyCheckins)).toBe(3);
    });
  });
});

describe("projects.slack_channel_id unique (A11)", () => {
  it("one channel = one project; many projects may have no channel", async () => {
    await withRollback(async (tx) => {
      await seedProject(tx, { slackChannelId: "CTEST00001" });
      await expectPgFailure(tx, (sp) => seedProject(sp, { slackChannelId: "CTEST00001" }), UNIQUE, "projects_slack_channel_id_unique");
      await seedProject(tx, { slackChannelId: null });
      await seedProject(tx, { slackChannelId: null });
      expect(await tx.$count(projects)).toBe(3);
    });
  });
});

describe("users.pto_allowance_days range (A9)", () => {
  it("accepts null, 0, 365 and 24.5; rejects -0.5 and 365.5", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const setAllowance = (sp: Tx, v: number | null) =>
        sp.update(users).set({ ptoAllowanceDays: v }).where(eq(users.id, u.id));
      for (const ok of [null, 0, 365, 24.5]) await setAllowance(tx, ok);
      await expectPgFailure(tx, (sp) => setAllowance(sp, -0.5), CHECK, "users_pto_allowance_days_range");
      await expectPgFailure(tx, (sp) => setAllowance(sp, 365.5), CHECK, "users_pto_allowance_days_range");
      const [row] = await tx.select({ v: users.ptoAllowanceDays }).from(users).where(eq(users.id, u.id));
      expect(row.v).toBe(24.5);
    });
  });
});
