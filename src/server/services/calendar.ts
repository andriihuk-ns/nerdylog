import type { IsoDate, MonthWeek, PreviousBusinessDay } from "@/contracts";

/**
 * Pure calendar helpers. All math runs on "YYYY-MM-DD" strings through UTC midnight,
 * so the server timezone never shifts a date. Dates are already user-local (docs/02).
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 86_400_000;

function toUtcMs(date: IsoDate): number {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError(`Invalid ISO date: ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (fromUtcMs(ms) !== date) throw new RangeError(`Invalid ISO date: ${date}`);
  return ms;
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

export function isWeekend(date: IsoDate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

/** First and last date of a "YYYY-MM" month. */
export function monthRange(month: string): { start: IsoDate; end: IsoDate } {
  const m = MONTH.exec(month);
  if (!m) throw new RangeError(`Invalid month: ${month}`);
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  return {
    start: fromUtcMs(Date.UTC(year, monthIndex, 1)),
    end: fromUtcMs(Date.UTC(year, monthIndex + 1, 0)),
  };
}

/** True when `date` lies inside the "YYYY-MM" month. */
export function isInMonth(date: IsoDate, month: string): boolean {
  return date.slice(0, 7) === month;
}

/**
 * Amendment A2 month-weeks: Week 1 = the 1st through the first Sunday (a single day
 * when the 1st is a Sunday); each next week is Mon–Sun; the last week ends on the
 * month's last day. Never more than 6 weeks.
 */
export function monthWeeks(month: string): MonthWeek[] {
  const { start, end } = monthRange(month);
  const weeks: MonthWeek[] = [];
  let cursor = start;
  let span = (7 - dayOfWeek(start)) % 7; // days from the 1st to its Sunday
  while (cursor <= end) {
    const candidate = addDays(cursor, span);
    const weekEnd = candidate < end ? candidate : end;
    weeks.push({ weekIndex: weeks.length + 1, start: cursor, end: weekEnd });
    cursor = addDays(weekEnd, 1);
    span = 6; // every later week starts on a Monday
  }
  return weeks;
}

/** Contract PreviousBusinessDay: the latest earlier date that is not a weekend or holiday. */
export const previousBusinessDay: PreviousBusinessDay = (date, holidays) => {
  let day = addDays(date, -1);
  while (isWeekend(day) || holidays.has(day)) day = addDays(day, -1);
  return day;
};

/** ISO 8601 week number (1–53) for the ledger CSV `ISO_Week` column. */
export function isoWeek(date: IsoDate): number {
  const ms = toUtcMs(date);
  const isoDow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = ms + (3 - isoDow) * DAY_MS; // the week belongs to its Thursday's year
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.floor((thursday - yearStart) / DAY_MS / 7) + 1;
}
