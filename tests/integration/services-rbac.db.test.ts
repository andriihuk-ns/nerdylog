/**
 * Service-layer RBAC smoke against real SQL (A5: Drizzle bypasses RLS, services enforce roles).
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", async () => {
  const { activeTx } = await import("./db");
  return { getDb: () => activeTx(), closeDb: async () => {} };
});

import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { SlackDirectoryMember } from "@/contracts";
import { timeEntries, users } from "@/server/db/schema";
import { syncDirectoryFromSlack } from "@/server/services/directory-service";
import { ForbiddenError } from "@/server/services/errors";
import {
  createTimeEntry,
  deleteTimeEntry,
  listWeekEntries,
  setDayStatus,
  updateTimeEntry,
} from "@/server/services/time-entry-service";
import { withRollback } from "./db";
import { actorOf, seedEntries, seedProject, seedUser } from "./fixtures";

describe("time-entry-service RBAC", () => {
  it("member cannot update, delete, create or list another user's entries; row is unchanged", async () => {
    await withRollback(async (tx) => {
      const member = await seedUser(tx);
      const other = await seedUser(tx);
      const p = await seedProject(tx);
      const [id] = await seedEntries(tx, [{ userId: other.id, date: "2026-11-02", hours: 6, projectId: p }]);
      const actor = actorOf(member);
      await expect(updateTimeEntry(actor, id, { hours: 1 })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deleteTimeEntry(actor, id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        createTimeEntry(actor, { userId: other.id, projectId: p, workDate: "2026-11-03", hours: 1, entryType: "work", taskSummary: "" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listWeekEntries(actor, other.id, "2026-11-02")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setDayStatus(actor, other.id, "2026-11-02", "sick")).rejects.toBeInstanceOf(ForbiddenError);
      const rows = await tx.select().from(timeEntries).where(inArray(timeEntries.userId, [member.id, other.id]));
      expect(rows).toHaveLength(1);
      expect(rows[0].hours).toBe(6);
    });
  });

  it.each(["manager", "admin"] as const)("%s can update and delete another user's entry (PRD §2)", async (role) => {
    await withRollback(async (tx) => {
      const boss = await seedUser(tx, { role });
      const other = await seedUser(tx);
      const p = await seedProject(tx);
      const [id, id2] = await seedEntries(tx, [
        { userId: other.id, date: "2026-11-02", hours: 6, projectId: p },
        { userId: other.id, date: "2026-11-03", hours: 2, projectId: p },
      ]);
      const view = await updateTimeEntry(actorOf(boss), id, { hours: 7.5, taskSummary: "Fix DOG-1364" });
      expect(view).toMatchObject({ userId: other.id, hours: 7.5, ticketRefs: ["DOG-1364"], source: "web_ui" });
      await deleteTimeEntry(actorOf(boss), id2);
      expect(await tx.$count(timeEntries, eq(timeEntries.userId, other.id))).toBe(1);
    });
  });

  it("member can update own entry", async () => {
    await withRollback(async (tx) => {
      const member = await seedUser(tx);
      const p = await seedProject(tx);
      const [id] = await seedEntries(tx, [{ userId: member.id, date: "2026-11-02", hours: 6, projectId: p }]);
      const view = await updateTimeEntry(actorOf(member), id, { hours: 2.5 });
      expect(view.hours).toBe(2.5);
    });
  });
});

describe("setDayStatus (FR-WEB-02)", () => {
  it("vacation removes that day's work rows and writes one 0h vacation row; other days untouched", async () => {
    await withRollback(async (tx) => {
      const member = await seedUser(tx);
      const p = await seedProject(tx);
      await seedEntries(tx, [
        { userId: member.id, date: "2026-11-02", hours: 4, projectId: p },
        { userId: member.id, date: "2026-11-02", hours: 3, projectId: p },
        { userId: member.id, date: "2026-11-03", hours: 8, projectId: p },
      ]);
      const day = await setDayStatus(actorOf(member), member.id, "2026-11-02", "vacation");
      expect(day).toHaveLength(1);
      expect(day[0]).toMatchObject({ entryType: "vacation", hours: 0, projectId: null, workDate: "2026-11-02" });
      const all = await tx.select().from(timeEntries).where(eq(timeEntries.userId, member.id));
      expect(all.map((r) => [r.workDate, r.entryType, r.hours]).sort()).toEqual([
        ["2026-11-02", "vacation", 0],
        ["2026-11-03", "work", 8],
      ]);

      const back = await setDayStatus(actorOf(member), member.id, "2026-11-02", "work");
      expect(back).toEqual([]); // PTO row removed; previous work rows are not restored
    });
  });
});

describe("syncDirectoryFromSlack", () => {
  const members = (name: string, tz: string | null): SlackDirectoryMember[] => [
    { slackUserId: "UTESTSYNC1", fullName: name, email: "sync1@example.test", avatarUrl: null, title: null, timezone: tz },
    { slackUserId: "UTESTSYNC2", fullName: "Sync Two", email: null, avatarUrl: null, title: null, timezone: null },
  ];

  it("creates, then updates profile fields without touching role/norm/allowance/active/auth", async () => {
    await withRollback(async (tx) => {
      const admin = await seedUser(tx, { role: "admin" });
      expect(await syncDirectoryFromSlack(actorOf(admin), members("Sync One", "Europe/Kyiv"))).toEqual({ created: 2, updated: 0 });

      const authId = "11111111-2222-4333-8444-555555555555";
      await tx
        .update(users)
        .set({ role: "manager", dailyNormHours: 6, ptoAllowanceDays: 20, isActive: false, authUserId: authId })
        .where(eq(users.slackUserId, "UTESTSYNC1"));

      const second = await syncDirectoryFromSlack(actorOf(admin), members("Sync One Renamed", "Europe/Warsaw"));
      expect(second).toEqual({ created: 0, updated: 2 });
      const [row] = await tx.select().from(users).where(eq(users.slackUserId, "UTESTSYNC1"));
      expect(row).toMatchObject({
        fullName: "Sync One Renamed",
        timezone: "Europe/Warsaw",
        email: "sync1@example.test",
        role: "manager",
        dailyNormHours: 6,
        ptoAllowanceDays: 20,
        isActive: false,
        authUserId: authId,
      });
      const [fresh] = await tx.select().from(users).where(eq(users.slackUserId, "UTESTSYNC2"));
      expect(fresh).toMatchObject({ role: "member", isActive: true, dailyNormHours: 8, timezone: "Europe/Kyiv" });
    });
  });

  it.each(["member", "manager"] as const)("%s cannot sync the directory", async (role) => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx, { role });
      await expect(syncDirectoryFromSlack(actorOf(u), members("X", null))).rejects.toBeInstanceOf(ForbiddenError);
      // Nothing from the payload was written (the dev DB holds real users, so no global count).
      expect(await tx.$count(users, inArray(users.slackUserId, ["UTESTSYNC1", "UTESTSYNC2"]))).toBe(0);
    });
  });
});
