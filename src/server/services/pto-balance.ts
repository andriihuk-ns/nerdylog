import type { IsoDate, PtoBalance } from "@/contracts";

export interface PtoUsageRow {
  workDate: IsoDate;
  entryType: "vacation" | "sick";
}

/** Calendar-year bounds for A9 (`YYYY-01-01`..`YYYY-12-31`). Throws RangeError on a bad year. */
export function yearRange(year: number): { start: IsoDate; end: IsoDate } {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError(`Invalid year: ${year}`);
  }
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Round to one decimal so float noise (20.5 - 3) never leaks; matches numeric(4,1). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Pure A9 math. Counts DISTINCT vacation and sick dates (a date logged twice counts once).
 * Each allowance is reduced by its own distinct used days; remaining is null when its allowance
 * is unset and may go negative. Rows are assumed to be inside `year` already.
 */
export function computePtoBalance(
  userId: string,
  year: number,
  allowanceDays: number | null,
  rows: readonly PtoUsageRow[],
  sickAllowanceDays: number | null = null,
): PtoBalance {
  const vacation = new Set<string>();
  const sick = new Set<string>();
  for (const row of rows) (row.entryType === "vacation" ? vacation : sick).add(row.workDate);
  const vacationUsedDays = vacation.size;
  const sickUsedDays = sick.size;
  return {
    userId,
    year,
    allowanceDays,
    sickAllowanceDays,
    vacationUsedDays,
    sickUsedDays,
    remainingDays: allowanceDays === null ? null : round1(allowanceDays - vacationUsedDays),
    sickRemainingDays: sickAllowanceDays === null ? null : round1(sickAllowanceDays - sickUsedDays),
  };
}
