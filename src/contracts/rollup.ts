import type { IsoDate } from "./time";

/** One month-week bucket (PRD amendment A2). weekIndex starts at 1. */
export interface MonthWeek {
  weekIndex: number;
  start: IsoDate;
  end: IsoDate;
}

/** Totals for one user in one bucket (a month-week or the whole month). */
export interface RollupTotals {
  hours: number;
  days: number;
  vacSick: number;
  holidays: number;
}

/** One row of the /team Summary matrix and the Monthly Summary Pivot CSV. */
export interface UserMonthRollup {
  userId: string;
  fullName: string;
  dailyNormHours: number;
  month: string; // "YYYY-MM"
  weeks: Array<MonthWeek & RollupTotals>;
  total: RollupTotals;
}

export type CapStatus = "neutral" | "warning" | "over";

export const CAP_WARNING_RATIO = 0.85;

/** Client cap state (PRD FR-WEB-03): neutral < 85%, warning 85–99%, over ≥ 100%. */
export function capStatus(usedHours: number, capHours: number | null): CapStatus {
  if (capHours === null || capHours <= 0) return "neutral";
  const ratio = usedHours / capHours;
  if (ratio >= 1) return "over";
  if (ratio >= CAP_WARNING_RATIO) return "warning";
  return "neutral";
}

export interface ProjectCapUsage {
  projectId: string;
  projectName: string;
  month: string; // "YYYY-MM"
  usedHours: number;
  capHours: number | null;
  status: CapStatus;
}
