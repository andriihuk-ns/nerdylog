import type { ClaimProjectPrompts, IsoDate } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listOfficeHolidayDates } from "@/server/db/queries/catalog";
import { claimProjectPromptRows, listOfficeZones, listPromptProjectRows } from "@/server/db/queries/project-prompts";
import { addDays } from "./calendar";
import { promptWindowCandidates, selectPromptTargets } from "./project-prompt-decision";

/** Holiday lookback so previousBusinessDay can skip long holiday runs before a weekday. */
const HOLIDAY_LOOKBACK_DAYS = 31;

/**
 * Contract ClaimProjectPrompts (A16). System call (pg_cron only, no actor).
 * 1. active projects with a channel → those whose office-local time is in [prompt, prompt + 90 min)
 *    on a local weekday (pure; a project without an office uses the UA office);
 * 2. drop projects on a holiday of their office;
 * 3. insert project_prompts ON CONFLICT DO NOTHING and return only rows this call inserted,
 *    so overlapping or retried cron runs never double-post.
 * A claimed prompt is not released if the Slack post later fails (at most one try per day).
 */
export const claimProjectPrompts: ClaimProjectPrompts = async (now) => {
  const db = getDb();
  const projects = await listPromptProjectRows(db);
  if (projects.length === 0) return [];
  const candidates = promptWindowCandidates(now, projects, await listOfficeZones(db));
  if (candidates.length === 0) return [];

  const dates = [...new Set(candidates.map((c) => c.clock.date))].sort();
  const officeIds = [...new Set(candidates.flatMap((c) => (c.officeId ? [c.officeId] : [])))];
  const holidayRows = await listOfficeHolidayDates(db, officeIds, addDays(dates[0], -HOLIDAY_LOOKBACK_DAYS), dates[dates.length - 1]);
  const holidaysByOffice = new Map<string, Set<IsoDate>>();
  for (const { officeId, date } of holidayRows) {
    holidaysByOffice.set(officeId, (holidaysByOffice.get(officeId) ?? new Set<IsoDate>()).add(date));
  }

  const targets = selectPromptTargets(candidates, holidaysByOffice);
  const claimed = new Set(
    await claimProjectPromptRows(
      db,
      targets.map((t) => ({ projectId: t.projectId, promptDate: t.localDate })),
    ),
  );
  return targets.filter((t) => claimed.has(t.projectId));
};
