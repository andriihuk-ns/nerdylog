import {
  type EntryType,
  type IsoDate,
  type MonthWeek,
  type ProjectHours,
  type RollupTotals,
  type UserMonthRollup,
} from "@/contracts";
import { isInMonth, monthWeeks } from "./calendar";

/**
 * Pure rollup math (docs/02 "Rollup spec"). No DB access. Inputs are Stream A
 * `time_entries` only; `daily_checkins` are not an input by design.
 */

export const DEFAULT_DAILY_NORM_HOURS = 8.0;

export interface RollupUser {
  id: string;
  fullName: string;
  dailyNormHours: number;
}

export interface RollupEntry {
  userId: string;
  workDate: IsoDate;
  hours: number;
  entryType: EntryType;
  projectId: string | null;
}

export interface NamedProject {
  id: string;
  name: string;
}

/** Hours are numeric(4,2); round sums to cents so float noise never reaches the UI. */
function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function effectiveNorm(norm: number): number {
  return Number.isFinite(norm) && norm > 0 ? norm : DEFAULT_DAILY_NORM_HOURS;
}

/** Totals for one user's entries inside one bucket. */
export function computeTotals(entries: readonly RollupEntry[], dailyNormHours: number): RollupTotals {
  let hours = 0;
  const vacSickDays = new Set<IsoDate>();
  const holidayDays = new Set<IsoDate>();
  for (const e of entries) {
    if (e.entryType === "work") hours += e.hours;
    else if (e.entryType === "vacation" || e.entryType === "sick") vacSickDays.add(e.workDate);
    else if (e.entryType === "holiday") holidayDays.add(e.workDate);
  }
  hours = roundHours(hours);
  return {
    hours,
    days: hours / effectiveNorm(dailyNormHours),
    vacSick: vacSickDays.size,
    holidays: holidayDays.size,
  };
}

function inWeek(date: IsoDate, week: MonthWeek): boolean {
  return date >= week.start && date <= week.end;
}

/**
 * One UserMonthRollup per user, in the order given. Entries outside `month` and
 * entries of users not in `users` are ignored. Weekend work counts.
 */
export function aggregateMonth(
  month: string,
  users: readonly RollupUser[],
  entries: readonly RollupEntry[],
): UserMonthRollup[] {
  const weeks = monthWeeks(month);
  const byUser = new Map<string, RollupEntry[]>(users.map((u) => [u.id, []]));
  for (const e of entries) {
    if (isInMonth(e.workDate, month)) byUser.get(e.userId)?.push(e);
  }
  return users.map((u) => {
    const own = byUser.get(u.id) ?? [];
    return {
      userId: u.id,
      fullName: u.fullName,
      dailyNormHours: u.dailyNormHours,
      month,
      weeks: weeks.map((w) => ({
        ...w,
        ...computeTotals(
          own.filter((e) => inWeek(e.workDate, w)),
          u.dailyNormHours,
        ),
      })),
      total: computeTotals(own, u.dailyNormHours),
    };
  });
}

/**
 * A15: month `work` hours per project for the entries passed in (callers pass one user's rows).
 * Only projects with hours > 0 that appear in `projects` are returned, sorted by name.
 */
export function projectHours(
  month: string,
  projects: readonly NamedProject[],
  entries: readonly RollupEntry[],
): ProjectHours[] {
  const used = new Map<string, number>();
  for (const e of entries) {
    if (e.entryType !== "work" || e.projectId === null || !isInMonth(e.workDate, month)) continue;
    used.set(e.projectId, (used.get(e.projectId) ?? 0) + e.hours);
  }
  return projects
    .map((p) => ({ projectId: p.id, projectName: p.name, month, hours: roundHours(used.get(p.id) ?? 0) }))
    .filter((p) => p.hours > 0)
    .sort((a, b) => a.projectName.localeCompare(b.projectName) || a.projectId.localeCompare(b.projectId));
}
