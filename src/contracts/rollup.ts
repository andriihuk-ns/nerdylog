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

/** A15: hours per project for one month (caps were removed). */
export interface ProjectHours {
  projectId: string;
  projectName: string;
  month: string; // "YYYY-MM"
  hours: number;
}
