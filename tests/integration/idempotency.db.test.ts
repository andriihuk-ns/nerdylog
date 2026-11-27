/**
 * A1 idempotency and Stream B isolation through the real `submitSlackSubmission` service.
 * getDb() is the test transaction; the service's own transaction nests as a savepoint.
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", async () => {
  const { activeTx } = await import("./db");
  return { getDb: () => activeTx(), closeDb: async () => {} };
});

import { describe, expect, it } from "vitest";
import type { SlackSubmissionInput } from "@/contracts";
import type { Tx } from "@/server/db/queries/types";
import { dailyCheckins, slackSubmissions, timeEntries } from "@/server/db/schema";
import { getTeamMonthRollup } from "@/server/services/rollup-service";
import { submitSlackSubmission } from "@/server/services/standup-service";
import { InvalidInputError } from "@/server/services/errors";
import { InvalidSubmissionError } from "@/server/services/standup-rows";
import { withRollback } from "./db";
import { seedProject, seedUser } from "./fixtures";

const counts = async (tx: Tx) => ({
  submissions: await tx.$count(slackSubmissions),
  entries: await tx.$count(timeEntries),
  checkins: await tx.$count(dailyCheckins),
});

function standup(userId: string, projectId: string, viewId = "VTEST_STANDUP_1"): SlackSubmissionInput {
  return {
    viewId,
    userId,
    kind: "standup",
    entries: [
      { userId, projectId, workDate: "2026-11-25", hours: 4, entryType: "work", taskSummary: "Map modal DOG-1364", source: "slack_standup", slackViewId: null },
      { userId, projectId, workDate: "2026-11-25", hours: 2.5, entryType: "work", taskSummary: "Review CNG-009", source: "slack_standup", slackViewId: null },
    ],
    checkin: { userId, checkinDate: "2026-11-26", plannedToday: "Handler flow", blockers: "None" },
  };
}

describe("submitSlackSubmission idempotency (A1)", () => {
  it("same viewId twice → second call is duplicate and row counts are unchanged", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const p = await seedProject(tx, { members: [u.id] });
      const first = await submitSlackSubmission(standup(u.id, p));
      expect(first.status).toBe("created");
      if (first.status === "created") expect(first.entryIds).toHaveLength(2);
      const after = await counts(tx);
      expect(after).toEqual({ submissions: 1, entries: 2, checkins: 1 });

      const second = await submitSlackSubmission(standup(u.id, p));
      expect(second).toEqual({ status: "duplicate" });
      expect(await counts(tx)).toEqual(after);

      const rows = await tx.select().from(timeEntries);
      expect(rows.every((r) => r.slackViewId === "VTEST_STANDUP_1")).toBe(true);
      expect(rows.map((r) => r.ticketRefs).sort()).toEqual([["CNG-009"], ["DOG-1364"]]);
    });
  });

  it("an invalid entry throws InvalidSubmissionError and writes nothing", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const p = await seedProject(tx, { members: [u.id] });
      const other = await seedUser(tx);
      const before = await counts(tx);
      const bad = standup(u.id, p);
      bad.entries[1] = { ...bad.entries[1], hours: 25 };
      await expect(submitSlackSubmission(bad)).rejects.toBeInstanceOf(InvalidSubmissionError);
      const foreign = standup(u.id, p, "VTEST_STANDUP_2");
      foreign.entries[0] = { ...foreign.entries[0], userId: other.id };
      await expect(submitSlackSubmission(foreign)).rejects.toBeInstanceOf(InvalidSubmissionError);
      const ptoWithHours = standup(u.id, p, "VTEST_STANDUP_3");
      ptoWithHours.entries = [{ ...ptoWithHours.entries[0], entryType: "vacation", projectId: null, hours: 8 }];
      await expect(submitSlackSubmission(ptoWithHours)).rejects.toBeInstanceOf(InvalidSubmissionError);
      expect(await counts(tx)).toEqual(before);
    });
  });

  it("a failing time-entry insert rolls back the ledger row too (one transaction)", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const p = await seedProject(tx, { members: [u.id] });
      const before = await counts(tx);
      const input = standup(u.id, p, "VTEST_FK");
      // A PTO row may carry a project id (Zod and the membership check only look at work rows),
      // so a missing project reaches Postgres and fails the FK inside the transaction.
      const missingProject = "00000000-0000-4000-8000-000000000000";
      input.entries[1] = { ...input.entries[1], entryType: "vacation", hours: 0, projectId: missingProject };
      await expect(submitSlackSubmission(input)).rejects.toThrow();
      expect(await counts(tx)).toEqual(before);
    });
  });

  it("A15: a work row for a project the user is not a member of → not_member, nothing written", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const p = await seedProject(tx); // u is not a member
      const before = await counts(tx);
      const err = await submitSlackSubmission(standup(u.id, p, "VTEST_NOT_MEMBER")).catch((e) => e);
      expect(err).toBeInstanceOf(InvalidInputError);
      expect(err.fieldErrors).toEqual({ projectId: ["not_member"] });
      expect(await counts(tx)).toEqual(before);
    });
  });
});

describe("Stream B isolation", () => {
  it("plan/blockers with ticket refs and numbers create a check-in and no time_entries", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const result = await submitSlackSubmission({
        viewId: "VTEST_STREAM_B",
        userId: u.id,
        kind: "standup",
        entries: [],
        checkin: {
          userId: u.id,
          checkinDate: "2026-11-26",
          plannedToday: "DOG-1364 8h, CNG-009 4 hours, then 2.5h on ABC-77",
          blockers: "Waiting on XYZ-1 (16h estimate)",
        },
      });
      expect(result).toEqual({ status: "created", entryIds: [] });
      expect(await counts(tx)).toEqual({ submissions: 1, entries: 0, checkins: 1 });
      const [checkin] = await tx.select().from(dailyCheckins);
      expect(checkin.plannedToday).toContain("DOG-1364");

      const [row] = await getTeamMonthRollup({ userId: u.id, role: "member" }, "2026-11");
      expect(row.total).toEqual({ hours: 0, days: 0, vacSick: 0, holidays: 0 });
    });
  });

  it("check-in text never adds hours or ticket refs to the entries of the same submission", async () => {
    await withRollback(async (tx) => {
      const u = await seedUser(tx);
      const p = await seedProject(tx, { members: [u.id] });
      const input = standup(u.id, p, "VTEST_STREAM_B2");
      input.checkin = { userId: u.id, checkinDate: "2026-11-26", plannedToday: "QQQ-42 for 8h", blockers: "ZZZ-9 12h" };
      await submitSlackSubmission(input);
      const rows = await tx.select().from(timeEntries);
      expect(rows.reduce((s, r) => s + r.hours, 0)).toBe(6.5);
      expect(rows.flatMap((r) => r.ticketRefs)).not.toContain("QQQ-42");
      expect(rows.flatMap((r) => r.ticketRefs)).not.toContain("ZZZ-9");
      const [roll] = await getTeamMonthRollup({ userId: u.id, role: "member" }, "2026-11");
      expect(roll.total.hours).toBe(6.5);
    });
  });
});
