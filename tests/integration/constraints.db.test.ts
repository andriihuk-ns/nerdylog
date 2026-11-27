/**
 * DB constraints (PRD A6, A8, A9, A11, A15): drizzle/0000_init.sql, 0002, 0003, 0011.
 * Each violating statement runs in a savepoint so the test transaction stays usable.
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/queries/types";
import { companyHolidays, dailyCheckins, offices, projectMembers, projects, timeEntries, users } from "@/server/db/schema";
import { expectPgFailure, withRollback } from "./db";
import { seedHoliday, seedOffice, seedProject, seedUser } from "./fixtures";

const CHECK = "23514";
const UNIQUE = "23505";
const FK = "23503";

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

describe("offices, per-office holidays and project members (A15)", () => {
  it("the migration seeded offices UA and PL", async () => {
    await withRollback(async (tx) => {
      const codes = (await tx.select({ code: offices.code }).from(offices)).map((o) => o.code);
      expect(codes).toEqual(expect.arrayContaining(["UA", "PL"]));
    });
  });

  it("holiday dates are unique per office, not globally", async () => {
    await withRollback(async (tx) => {
      const a = await seedOffice(tx);
      const b = await seedOffice(tx);
      await seedHoliday(tx, a, "2031-12-25");
      await seedHoliday(tx, b, "2031-12-25");
      await expectPgFailure(tx, (sp) => seedHoliday(sp, a, "2031-12-25"), UNIQUE, "company_holidays_office_date_unique");
      expect(await tx.$count(companyHolidays, eq(companyHolidays.holidayDate, "2031-12-25"))).toBe(2);
    });
  });

  it("an office with holidays cannot be deleted; deleting an office clears users.office_id", async () => {
    await withRollback(async (tx) => {
      const withHoliday = await seedOffice(tx);
      await seedHoliday(tx, withHoliday, "2031-01-01");
      await expectPgFailure(
        tx,
        (sp) => sp.delete(offices).where(eq(offices.id, withHoliday)),
        FK,
        "company_holidays_office_id_offices_id_fk",
      );
      const office = await seedOffice(tx);
      const u = await seedUser(tx, { officeId: office });
      await tx.delete(offices).where(eq(offices.id, office));
      const [row] = await tx.select({ officeId: users.officeId }).from(users).where(eq(users.id, u.id));
      expect(row.officeId).toBeNull();
    });
  });

  it("project_members: one row per (project, user); cascades from project and user; created_by set null", async () => {
    await withRollback(async (tx) => {
      const keep = await seedUser(tx);
      const creator = await seedUser(tx);
      const p = await seedProject(tx, { members: [keep.id, creator.id] });
      await tx.update(projects).set({ createdBy: creator.id }).where(eq(projects.id, p));
      await expectPgFailure(
        tx,
        (sp) => sp.insert(projectMembers).values({ projectId: p, userId: keep.id }),
        UNIQUE,
        "project_members_pk",
      );
      await tx.delete(users).where(eq(users.id, creator.id)); // no time entries → deletable
      const [proj] = await tx.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, p));
      expect(proj.createdBy).toBeNull();
      expect(await tx.$count(projectMembers, eq(projectMembers.projectId, p))).toBe(1);
      await tx.delete(projects).where(eq(projects.id, p));
      expect(await tx.$count(projectMembers, eq(projectMembers.userId, keep.id))).toBe(0);
    });
  });
});
