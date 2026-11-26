/**
 * RLS as the Supabase `authenticated` role (drizzle/0001_rls_policies.sql, 0004_app_settings_rls.sql),
 * checked against docs/02 "RLS" table and PRD A5/A7. Defence in depth: Drizzle bypasses RLS.
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/queries/types";
import {
  appSettings,
  companyHolidays,
  dailyCheckins,
  dailyPings,
  projects,
  slackSubmissions,
  timeEntries,
  users,
} from "@/server/db/schema";
import { PUBLIC_TABLES, withRollback } from "./db";
import { seedEntries, seedProject, seedUser, type SeededUser } from "./fixtures";
import { asAnon, asAuth, expectRlsDenied, grantDataApi } from "./rls-session";

interface World {
  member: SeededUser;
  other: SeededUser;
  manager: SeededUser;
  admin: SeededUser;
  inactive: SeededUser;
  projectId: string;
  otherEntryId: string;
}

async function seedWorld(tx: Tx): Promise<World> {
  await grantDataApi(tx);
  const member = await seedUser(tx, { role: "member" });
  const other = await seedUser(tx, { role: "member" });
  const manager = await seedUser(tx, { role: "manager" });
  const admin = await seedUser(tx, { role: "admin" });
  const inactive = await seedUser(tx, { role: "admin", isActive: false });
  const projectId = await seedProject(tx);
  await seedEntries(tx, [{ userId: member.id, date: "2026-11-02", hours: 4, projectId }]);
  const [otherEntryId] = await seedEntries(tx, [{ userId: other.id, date: "2026-11-02", hours: 6, projectId }]);
  await seedEntries(tx, [{ userId: inactive.id, date: "2026-11-02", type: "sick" }]);
  await tx.insert(dailyCheckins).values([
    { userId: member.id, checkinDate: "2026-11-02", plannedToday: "member plan" },
    { userId: other.id, checkinDate: "2026-11-02", plannedToday: "other plan" },
  ]);
  await tx.insert(slackSubmissions).values({ viewId: "VTEST_RLS", userId: member.id, kind: "log" });
  await tx.insert(dailyPings).values({ userId: member.id, pingDate: "2026-11-02" });
  await tx.insert(appSettings).values({ key: "standup_channel_id", value: "CTEST00001" });
  return { member, other, manager, admin, inactive, projectId, otherEntryId };
}

const sub = (u: SeededUser) => u.authUserId as string;
const entryOwners = (sp: Tx) => sp.select({ userId: timeEntries.userId }).from(timeEntries);
const checkinOwners = (sp: Tx) => sp.select({ userId: dailyCheckins.userId }).from(dailyCheckins);

describe("RLS as deployed: no Data-API grants", () => {
  it("authenticated (even an active admin) is denied on all 8 public tables", async () => {
    await withRollback(async (tx) => {
      const admin = await seedUser(tx, { role: "admin" });
      for (const table of Object.values(PUBLIC_TABLES)) {
        await expectRlsDenied(tx, sub(admin), (sp) => sp.select().from(table).limit(1), "privilege");
      }
    });
  });
});

describe("RLS policies (Data-API grants simulated in the tx): reads", () => {
  it("member sees only own time_entries and daily_checkins", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const seen = await asAuth(tx, sub(w.member), async (sp) => ({
        entries: await entryOwners(sp),
        checkins: await checkinOwners(sp),
        users: await sp.select({ id: users.id }).from(users),
      }));
      expect(seen.entries.map((r) => r.userId)).toEqual([w.member.id]);
      expect(seen.checkins.map((r) => r.userId)).toEqual([w.member.id]);
      expect(seen.users.map((r) => r.id)).toEqual([w.member.id]);
    });
  });

  it.each(["manager", "admin"] as const)("%s reads all time_entries, check-ins and users", async (who) => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const seen = await asAuth(tx, sub(w[who]), async (sp) => ({
        entries: await entryOwners(sp),
        checkins: await checkinOwners(sp),
        users: await sp.select({ id: users.id }).from(users),
      }));
      // The dev DB holds real rows too: scope every assertion to the ids this fixture created.
      const ours = new Set([w.member, w.other, w.manager, w.admin, w.inactive].map((u) => u.id));
      const mine = <T>(rows: T[], id: (r: T) => string) => rows.filter((r) => ours.has(id(r)));
      expect(new Set(mine(seen.entries, (r) => r.userId).map((r) => r.userId))).toEqual(
        new Set([w.member.id, w.other.id, w.inactive.id]),
      );
      expect(mine(seen.checkins, (r) => r.userId)).toHaveLength(2);
      expect(new Set(mine(seen.users, (r) => r.id).map((r) => r.id))).toEqual(ours);
    });
  });
});

describe("RLS policies: time_entries writes", () => {
  it("member cannot insert a time entry for another user", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      await expectRlsDenied(tx, sub(w.member), (sp) =>
        sp.insert(timeEntries).values({
          userId: w.other.id,
          projectId: w.projectId,
          workDate: "2026-11-03",
          hours: 1,
          entryType: "work",
          source: "web_ui",
        }),
      );
    });
  });

  it("member update/delete of another user's entry touches 0 rows; re-assigning own row is denied", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const result = await asAuth(tx, sub(w.member), async (sp) => ({
        updated: await sp.update(timeEntries).set({ hours: 1 }).where(eq(timeEntries.id, w.otherEntryId)).returning(),
        deleted: await sp.delete(timeEntries).where(eq(timeEntries.id, w.otherEntryId)).returning(),
      }));
      expect(result.updated).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
      const [row] = await tx.select().from(timeEntries).where(eq(timeEntries.id, w.otherEntryId));
      expect(row.hours).toBe(6);
      await expectRlsDenied(tx, sub(w.member), (sp) =>
        sp.update(timeEntries).set({ userId: w.other.id }).where(eq(timeEntries.userId, w.member.id)),
      );
    });
  });

  it.each(["manager", "admin"] as const)("%s can insert and update another user's entries (PRD §2)", async (who) => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const result = await asAuth(tx, sub(w[who]), async (sp) => {
        const inserted = await sp
          .insert(timeEntries)
          .values({ userId: w.other.id, workDate: "2026-11-04", hours: 0, entryType: "vacation", source: "web_ui" })
          .returning({ id: timeEntries.id });
        const updated = await sp
          .update(timeEntries)
          .set({ hours: 7.5 })
          .where(eq(timeEntries.id, w.otherEntryId))
          .returning({ hours: timeEntries.hours });
        return { inserted, updated };
      });
      expect(result.inserted).toHaveLength(1);
      expect(result.updated).toEqual([{ hours: 7.5 }]);
    });
  });
});

describe("RLS policies: daily_checkins writes are own-only", () => {
  it("member writes own check-in; nobody (even admin) writes another user's", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const own = await asAuth(tx, sub(w.member), (sp) =>
        sp.insert(dailyCheckins).values({ userId: w.member.id, checkinDate: "2026-11-03" }).returning(),
      );
      expect(own).toHaveLength(1);
      for (const actor of [w.member, w.manager, w.admin]) {
        await expectRlsDenied(tx, sub(actor), (sp) =>
          sp.insert(dailyCheckins).values({ userId: w.other.id, checkinDate: "2026-11-05" }),
        );
      }
    });
  });
});

describe("RLS policies: admin-only catalog tables", () => {
  it.each(["member", "manager"] as const)("%s cannot write projects, company_holidays, app_settings", async (who) => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      await expectRlsDenied(tx, sub(w[who]), (sp) => sp.insert(projects).values({ name: "Nope" }));
      await expectRlsDenied(tx, sub(w[who]), (sp) =>
        sp.insert(companyHolidays).values({ holidayDate: "2026-12-25", name: "Nope" }),
      );
      await expectRlsDenied(tx, sub(w[who]), (sp) => sp.insert(appSettings).values({ key: "k", value: "v" }));
      const touched = await asAuth(tx, sub(w[who]), (sp) =>
        sp.update(projects).set({ name: "Renamed" }).where(eq(projects.id, w.projectId)).returning(),
      );
      expect(touched).toHaveLength(0);
    });
  });

  it("admin can write projects, company_holidays and app_settings", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const out = await asAuth(tx, sub(w.admin), async (sp) => ({
        project: await sp.insert(projects).values({ name: "Admin Project" }).returning(),
        holiday: await sp.insert(companyHolidays).values({ holidayDate: "2026-12-25", name: "H" }).returning(),
        setting: await sp
          .update(appSettings)
          .set({ value: "CTEST00002" })
          .where(eq(appSettings.key, "standup_channel_id"))
          .returning(),
      }));
      expect(out.project).toHaveLength(1);
      expect(out.holiday).toHaveLength(1);
      expect(out.setting).toHaveLength(1);
    });
  });

  it("app_settings: member reads nothing, manager reads", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const read = (s: SeededUser) => asAuth(tx, sub(s), (sp) => sp.select().from(appSettings));
      expect(await read(w.member)).toHaveLength(0);
      expect(await read(w.manager)).toHaveLength(1);
    });
  });
});

describe("RLS policies: server-only tables and inactive / anonymous callers", () => {
  it("authenticated (even admin) gets nothing from slack_submissions and daily_pings", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      for (const actor of [w.member, w.admin]) {
        const seen = await asAuth(tx, sub(actor), async (sp) => ({
          subs: await sp.select().from(slackSubmissions),
          pings: await sp.select().from(dailyPings),
        }));
        expect(seen).toEqual({ subs: [], pings: [] });
        await expectRlsDenied(tx, sub(actor), (sp) =>
          sp.insert(slackSubmissions).values({ viewId: "VTEST_RLS_2", userId: actor.id, kind: "log" }),
        );
      }
    });
  });

  it("inactive user (even with role admin) sees no user data and cannot write", async () => {
    await withRollback(async (tx) => {
      const w = await seedWorld(tx);
      const seen = await asAuth(tx, sub(w.inactive), async (sp) => ({
        entries: await entryOwners(sp),
        checkins: await checkinOwners(sp),
        users: await sp.select().from(users),
        settings: await sp.select().from(appSettings),
        // Fixed in 0005 (QA finding 4): inactive users no longer read projects/company_holidays.
        projects: await sp.select().from(projects),
      }));
      expect(seen.entries).toEqual([]);
      expect(seen.checkins).toEqual([]);
      expect(seen.users).toEqual([]);
      expect(seen.settings).toEqual([]);
      expect(seen.projects).toHaveLength(0);
      await expectRlsDenied(tx, sub(w.inactive), (sp) => sp.insert(projects).values({ name: "Nope" }));
    });
  });

  it("anon role reads nothing from user-data tables", async () => {
    await withRollback(async (tx) => {
      await seedWorld(tx);
      const seen = await asAnon(tx, async (sp) => ({
        entries: await entryOwners(sp),
        users: await sp.select().from(users),
        projects: await sp.select().from(projects),
      }));
      expect(seen).toEqual({ entries: [], users: [], projects: [] });
    });
  });
});
