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
import { projectMembers, projectPrompts, projects, timeEntries, users } from "@/server/db/schema";
import { syncDirectoryFromSlack, updateDirectoryUser } from "@/server/services/directory-service";
import { ForbiddenError, InvalidInputError, NotFoundError } from "@/server/services/errors";
import { addHoliday, copyHolidays, listHolidayDatesForUser } from "@/server/services/holiday-service";
import { deleteOffice, listOffices, upsertOffice } from "@/server/services/office-service";
import { deleteProject, listProjects, replaceProjectMembers, upsertProject } from "@/server/services/project-service";
import {
  createTimeEntry,
  deleteTimeEntry,
  listWeekEntries,
  setDayStatus,
  updateTimeEntry,
} from "@/server/services/time-entry-service";
import { withRollback } from "./db";
import { actorOf, seedEntries, seedOffice, seedProject, seedUser } from "./fixtures";

describe("time-entry-service RBAC", () => {
  it("member cannot update, delete, create or list another user's entries; row is unchanged", async () => {
    await withRollback(async (tx) => {
      const member = await seedUser(tx);
      const other = await seedUser(tx);
      const p = await seedProject(tx, { members: [member.id, other.id] });
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
      const p = await seedProject(tx, { members: [other.id] });
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
      // Not a member (any more), but the project is unchanged → still editable (A15).
      const view = await updateTimeEntry(actorOf(member), id, { hours: 2.5 });
      expect(view.hours).toBe(2.5);
    });
  });
});

describe("project membership (A15)", () => {
  it("create/move requires the owner to be a member, even when a manager logs for them", async () => {
    await withRollback(async (tx) => {
      const boss = await seedUser(tx, { role: "manager" });
      const member = await seedUser(tx);
      const mine = await seedProject(tx, { members: [member.id] });
      const notMine = await seedProject(tx, { members: [boss.id] });
      const input = { userId: member.id, workDate: "2026-11-03", hours: 1, entryType: "work" as const, taskSummary: "" };
      const created = await createTimeEntry(actorOf(member), { ...input, projectId: mine });
      for (const actor of [actorOf(member), actorOf(boss)]) {
        const err = await createTimeEntry(actor, { ...input, projectId: notMine }).catch((e) => e);
        expect(err).toBeInstanceOf(InvalidInputError);
        expect(err.fieldErrors).toEqual({ projectId: ["not_member"] });
      }
      await expect(updateTimeEntry(actorOf(boss), created.id, { projectId: notMine })).rejects.toBeInstanceOf(InvalidInputError);
      expect(await tx.$count(timeEntries, eq(timeEntries.userId, member.id))).toBe(1);
    });
  });

  it("replaceProjectMembers keeps only known Slack ids; listProjects shows isMember per actor", async () => {
    await withRollback(async (tx) => {
      const admin = await seedUser(tx, { role: "admin" });
      const member = await seedUser(tx);
      const view = await upsertProject(actorOf(admin), { name: "A15 Project", slackChannelId: "CTESTA1500" });
      expect(view.createdBy).toEqual({ userId: admin.id, fullName: expect.any(String) });
      await expect(replaceProjectMembers(view.id, [member.slackUserId, "UTESTUNKNOWN"])).resolves.toEqual({
        members: 1,
        skipped: 1,
      });
      const forMember = (await listProjects(actorOf(member))).find((p) => p.id === view.id);
      const forAdmin = (await listProjects(actorOf(admin))).find((p) => p.id === view.id);
      expect(forMember).toMatchObject({ memberIds: [member.id], isMember: true });
      expect(forAdmin).toMatchObject({ memberIds: [member.id], isMember: false });
      await replaceProjectMembers(view.id, []);
      expect(await tx.$count(projectMembers, eq(projectMembers.projectId, view.id))).toBe(0);
    });
  });
});

describe("project prompt fields and delete (A16)", () => {
  it("upsert stores prompt time/office; list reports hasTimeEntries per project (correlated EXISTS)", async () => {
    await withRollback(async (tx) => {
      const admin = await seedUser(tx, { role: "admin" });
      const office = await seedOffice(tx, "Prompt Office", "Europe/Warsaw");
      const view = await upsertProject(actorOf(admin), { name: "A16 P", slackChannelId: "CTESTA1601" });
      expect(view).toMatchObject({ statusPromptTime: "10:00", statusPromptOfficeId: null, hasTimeEntries: false });
      const updated = await upsertProject(actorOf(admin), {
        id: view.id,
        name: "A16 P",
        slackChannelId: "CTESTA1601",
        statusPromptTime: "09:15",
        statusPromptOfficeId: office,
      });
      expect(updated).toMatchObject({ statusPromptTime: "09:15", statusPromptOfficeId: office });
      const used = await seedProject(tx);
      await seedEntries(tx, [{ userId: admin.id, date: "2026-11-02", hours: 1, projectId: used }]);
      const list = await listProjects(actorOf(admin));
      expect(list.find((p) => p.id === used)?.hasTimeEntries).toBe(true);
      expect(list.find((p) => p.id === view.id)?.hasTimeEntries).toBe(false);
      const input = { id: view.id, name: "A16 P", slackChannelId: null, statusPromptTime: "24:00" };
      const bad = await upsertProject(actorOf(admin), input).catch((e) => e);
      expect(Object.keys(bad.fieldErrors)).toEqual(["statusPromptTime"]);
    });
  });

  it("deleteProject: admin only, refuses with has_entries, cascades members and prompts, 404s missing", async () => {
    await withRollback(async (tx) => {
      const admin = await seedUser(tx, { role: "admin" });
      const manager = await seedUser(tx, { role: "manager" });
      const used = await seedProject(tx);
      await seedEntries(tx, [{ userId: admin.id, date: "2026-11-02", hours: 1, projectId: used }]);
      const free = await seedProject(tx, { members: [admin.id] });
      await tx.insert(projectPrompts).values({ projectId: free, promptDate: "2026-11-02" });
      await expect(deleteProject(actorOf(manager), free)).rejects.toBeInstanceOf(ForbiddenError);
      const err = await deleteProject(actorOf(admin), used).catch((e) => e);
      expect(err).toBeInstanceOf(InvalidInputError);
      expect(err.fieldErrors).toEqual({ _: ["has_entries"] });
      expect(await tx.$count(projects, eq(projects.id, used))).toBe(1);
      await deleteProject(actorOf(admin), free);
      expect(await tx.$count(projects, eq(projects.id, free))).toBe(0);
      expect(await tx.$count(projectMembers, eq(projectMembers.projectId, free))).toBe(0);
      expect(await tx.$count(projectPrompts, eq(projectPrompts.projectId, free))).toBe(0);
      await expect(deleteProject(actorOf(admin), free)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("offices and holidays (A15)", () => {
  it("assigning an office, copying holidays and refusing to delete a used office", async () => {
    await withRollback(async (tx) => {
      const admin = await seedUser(tx, { role: "admin" });
      const member = await seedUser(tx);
      const office = await upsertOffice(actorOf(admin), { code: "tq", name: "Test Office", timezone: "Europe/Warsaw" });
      expect(office).toMatchObject({ code: "TQ", timezone: "Europe/Warsaw", memberCount: 0 });
      const user = await updateDirectoryUser(actorOf(admin), member.id, { officeId: office.id });
      expect(user).toMatchObject({ officeId: office.id, projectIds: [] });
      await addHoliday(actorOf(admin), { officeId: office.id, holidayDate: "2028-02-29", name: "Leap" });
      await addHoliday(actorOf(admin), { officeId: office.id, holidayDate: "2028-12-25", name: "Різдво Христове" });
      await addHoliday(actorOf(admin), { officeId: office.id, holidayDate: "2029-12-25", name: "Already there" });
      await expect(copyHolidays(actorOf(admin), office.id, 2028, 2029)).resolves.toEqual({ copied: 0, skipped: 2 });
      await expect(copyHolidays(actorOf(admin), office.id, 2029, 2030)).resolves.toEqual({ copied: 1, skipped: 0 });
      expect(await listHolidayDatesForUser(member.id, "2029-01-01", "2030-12-31")).toEqual(["2029-12-25", "2030-12-25"]);
      expect(await listHolidayDatesForUser(admin.id, "2029-01-01", "2030-12-31")).toEqual([]); // no office
      const err = await deleteOffice(actorOf(admin), office.id).catch((e) => e);
      expect(Object.keys(err.fieldErrors).sort()).toEqual(["holidays", "members"]);
      const empty = await upsertOffice(actorOf(admin), { code: "TQZ", name: "Empty", timezone: "Europe/Kyiv" });
      await deleteOffice(actorOf(admin), empty.id);
      expect((await listOffices(actorOf(member))).some((o) => o.id === empty.id)).toBe(false);
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
