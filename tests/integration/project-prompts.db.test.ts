/**
 * claimProjectPrompts against real SQL (A16): active projects with a channel are claimed once per
 * office-local date when local time is in [status_prompt_time, +90 min), on a weekday that is not a
 * holiday of the prompt office (null office → the seeded UA office, Europe/Kyiv).
 * 2026-11-26 is a Thursday; Kyiv is UTC+2 and Warsaw UTC+1 in November.
 * The dev DB holds real projects too, so every assertion is scoped to the ids this test seeded.
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
import { projectPrompts } from "@/server/db/schema";
import { claimProjectPrompts } from "@/server/services/project-prompt-service";
import { withRollback } from "./db";
import { seedHoliday, seedOffice, seedProject } from "./fixtures";

const KYIV_10_00 = new Date("2026-11-26T08:00:00Z");
let channelSeq = 0;
const channel = () => `CTESTPR${Date.now().toString(36).toUpperCase()}${channelSeq++}`;

/** Claim, then keep only the targets for the given fixture projects. */
async function claimFor(ids: readonly string[], now: Date) {
  const keep = new Set(ids);
  return (await claimProjectPrompts(now)).filter((t) => keep.has(t.projectId));
}
const promptsOf = (tx: Tx, ids: readonly string[]) => tx.$count(projectPrompts, inArray(projectPrompts.projectId, [...ids]));

describe("claimProjectPrompts (A16)", () => {
  it("default 10:00 in UA (null office) is claimed once; later runs the same day return nothing", async () => {
    await withRollback(async (tx) => {
      const slackChannelId = channel();
      const p = await seedProject(tx, { name: "Prompt P", slackChannelId });
      expect(await claimFor([p], KYIV_10_00)).toEqual([
        { projectId: p, projectName: "Prompt P", slackChannelId, localDate: "2026-11-26", logDate: "2026-11-25" },
      ]);
      expect(await claimFor([p], KYIV_10_00)).toEqual([]);
      expect(await claimFor([p], new Date("2026-11-26T09:15:00Z"))).toEqual([]); // 11:15, same day
      expect(await promptsOf(tx, [p])).toBe(1);
    });
  });

  it("uses the prompt office's timezone and custom time (PL 09:30 = 08:30Z)", async () => {
    await withRollback(async (tx) => {
      const pl = await seedOffice(tx, "Test PL", "Europe/Warsaw");
      const p = await seedProject(tx, { slackChannelId: channel(), statusPromptOfficeId: pl, statusPromptTime: "09:30" });
      expect(await claimFor([p], KYIV_10_00)).toEqual([]); // 09:00 Warsaw
      expect(await claimFor([p], new Date("2026-11-26T08:30:00Z"))).toMatchObject([{ projectId: p, localDate: "2026-11-26" }]);
    });
  });

  it("skips archived projects, projects without a channel, weekends and the window edges", async () => {
    await withRollback(async (tx) => {
      const archived = await seedProject(tx, { slackChannelId: channel(), isActive: false });
      const noChannel = await seedProject(tx, { slackChannelId: null });
      const ok = await seedProject(tx, { slackChannelId: channel() });
      const all = [archived, noChannel, ok];
      expect(await claimFor(all, new Date("2026-11-26T07:59:59Z"))).toEqual([]); // 09:59:59
      expect(await claimFor(all, new Date("2026-11-26T09:30:00Z"))).toEqual([]); // 11:30 exclusive
      expect(await claimFor(all, new Date("2026-11-28T08:00:00Z"))).toEqual([]); // Saturday
      expect((await claimFor(all, KYIV_10_00)).map((t) => t.projectId)).toEqual([ok]);
    });
  });

  it("a holiday of the prompt office skips only its projects; Monday logDate skips that office's Friday holiday", async () => {
    await withRollback(async (tx) => {
      const officeA = await seedOffice(tx, "Test A");
      const officeB = await seedOffice(tx, "Test B");
      await seedHoliday(tx, officeA, "2026-11-26");
      await seedHoliday(tx, officeB, "2026-11-27");
      const a = await seedProject(tx, { slackChannelId: channel(), statusPromptOfficeId: officeA });
      const b = await seedProject(tx, { slackChannelId: channel(), statusPromptOfficeId: officeB });
      expect((await claimFor([a, b], KYIV_10_00)).map((t) => t.projectId)).toEqual([b]);
      expect(await promptsOf(tx, [a])).toBe(0);
      const monday = await claimFor([a, b], new Date("2026-11-30T08:00:00Z"));
      const byId = new Map(monday.map((t) => [t.projectId, t.logDate]));
      expect(byId.get(a)).toBe("2026-11-27");
      expect(byId.get(b)).toBe("2026-11-26");
    });
  });
});
