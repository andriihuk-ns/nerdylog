import type { CheckinView, IsoDate, RollupTotals, UserMonthRollup } from "@/contracts";

/** Pure helpers for the /team Summary matrix (amendment A2) and the Standup drawer (Stream B). */

/** Sub-column keys; labels live under `team.grid.sub` in messages/*.json. */
export const SUB_COLUMNS = ["hours", "days", "vacSick", "holidays"] as const;
export type SubColumn = (typeof SUB_COLUMNS)[number];

const zero = (): RollupTotals => ({ hours: 0, days: 0, vacSick: 0, holidays: 0 });
const round2 = (n: number) => Math.round(n * 100) / 100;

function add(a: RollupTotals, b: RollupTotals): RollupTotals {
  return {
    hours: round2(a.hours + b.hours),
    days: round2(a.days + b.days),
    vacSick: round2(a.vacSick + b.vacSick),
    holidays: round2(a.holidays + b.holidays),
  };
}

/** Footer row: team totals per month-week and for the month. Stream A only. */
export function teamTotals(rows: readonly UserMonthRollup[], weekCount: number) {
  const weeks = Array.from({ length: weekCount }, zero);
  let total = zero();
  for (const row of rows) {
    row.weeks.forEach((w, i) => {
      if (i < weekCount) weeks[i] = add(weeks[i], w);
    });
    total = add(total, row.total);
  }
  return { weeks, total };
}

/** The four sub-column values of one bucket, in SUB_COLUMNS order. */
export function bucketValues(t: RollupTotals): [number, number, number, number] {
  return [t.hours, t.days, t.vacSick, t.holidays];
}

/** A15 Team filters, kept in the URL so the server-rendered drawer applies them too. */
export interface TeamFilters {
  q: string;
  project: string | null;
}

export const NO_TEAM_FILTERS: TeamFilters = { q: "", project: null };

/** /team URL with month, optional drawer date and filters. */
export function teamHref(month: string, date?: IsoDate | null, filters: TeamFilters = NO_TEAM_FILTERS): string {
  const params = new URLSearchParams({ month });
  if (date) params.set("date", date);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.project) params.set("project", filters.project);
  return `/team?${params.toString()}`;
}

export interface RosterMember {
  userId: string;
  fullName: string;
}

/**
 * Drawer sections: blockers first, then all plans alphabetically, then teammates with no
 * check-in. Display only; nothing here is ever summed into hours.
 */
export function groupStandups(checkins: readonly CheckinView[], roster: readonly RosterMember[]) {
  const byName = (a: { fullName: string }, b: { fullName: string }) => a.fullName.localeCompare(b.fullName);
  const plans = [...checkins].sort(byName);
  const submitted = new Set(checkins.map((c) => c.userId));
  return {
    blockers: plans.filter((c) => c.hasBlocker),
    plans,
    missing: roster.filter((m) => !submitted.has(m.userId)).sort(byName),
  };
}
