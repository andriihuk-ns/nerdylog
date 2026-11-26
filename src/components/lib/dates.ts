import type { IsoDate } from "@/contracts";

/**
 * Pure date helpers for the UI. All math runs on "YYYY-MM-DD" strings through UTC
 * midnight (same approach as src/server/services/calendar.ts), so the browser or
 * server timezone never shifts a date.
 */

export const DEFAULT_TIMEZONE = "Europe/Kyiv";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 86_400_000;

function toUtcMs(date: IsoDate): number {
  const m = ISO_DATE.exec(date);
  if (!m) return Number.NaN;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === date ? ms : Number.NaN;
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && !Number.isNaN(toUtcMs(value));
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function isoDayIndex(date: IsoDate): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}

export function isWeekend(date: IsoDate): boolean {
  return isoDayIndex(date) >= 5;
}

/** Monday of the week that contains `date`. */
export function mondayOf(date: IsoDate): IsoDate {
  return addDays(date, -isoDayIndex(date));
}

/** The seven dates Mon–Sun starting at `weekStart`. */
export function weekDays(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Today as "YYYY-MM-DD" in an IANA timezone. */
export function todayIn(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `?week=` → Monday of that week; missing or invalid → Monday of `today`. */
export function parseWeekParam(value: string | string[] | undefined, today: IsoDate): IsoDate {
  return mondayOf(isIsoDate(value) ? value : today);
}

/** `?month=` → "YYYY-MM"; missing or invalid → month of `today`. */
export function parseMonthParam(value: string | string[] | undefined, today: IsoDate): string {
  return isMonth(value) ? value : today.slice(0, 7);
}

/** `?date=` → IsoDate, or null when missing/invalid. */
export function parseDateParam(value: string | string[] | undefined): IsoDate | null {
  return isIsoDate(value) ? value : null;
}

/**
 * Month whose client caps a week shows: today's month for the current week, otherwise
 * the month of the week's Thursday (the ISO rule for weeks that cross a month).
 */
export function monthForWeek(weekStart: IsoDate, today: IsoDate): string {
  const days = weekDays(weekStart);
  return (days.includes(today) ? today : days[3]).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function firstDayOfMonth(month: string): IsoDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: string): IsoDate {
  const [y, m] = month.split("-").map(Number);
  return fromUtcMs(Date.UTC(y, m, 0));
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts });
const monthShort = fmt({ month: "short" });
const monthLong = fmt({ month: "long", year: "numeric" });
const weekdayShort = fmt({ weekday: "short" });

function parts(date: IsoDate) {
  const d = new Date(toUtcMs(date));
  return { d, day: d.getUTCDate(), year: d.getUTCFullYear(), mon: monthShort.format(d) };
}

/** "Nov 23 – 29, 2026", "Nov 30 – Dec 6, 2026", "Dec 28, 2026 – Jan 3, 2027". */
export function formatWeekRange(start: IsoDate, end: IsoDate): string {
  const a = parts(start);
  const b = parts(end);
  if (a.year !== b.year) return `${a.mon} ${a.day}, ${a.year} – ${b.mon} ${b.day}, ${b.year}`;
  if (a.mon !== b.mon) return `${a.mon} ${a.day} – ${b.mon} ${b.day}, ${b.year}`;
  return `${a.mon} ${a.day} – ${b.day}, ${b.year}`;
}

/** Month-week caption: "Nov 1–2", "Nov 30". */
export function formatShortRange(start: IsoDate, end: IsoDate): string {
  const a = parts(start);
  const b = parts(end);
  if (start === end) return `${a.mon} ${a.day}`;
  return a.mon === b.mon ? `${a.mon} ${a.day}–${b.day}` : `${a.mon} ${a.day}–${b.mon} ${b.day}`;
}

/** "November 2026". */
export function formatMonth(month: string): string {
  return monthLong.format(new Date(`${month}-01T00:00:00Z`));
}

/** Column head parts: { weekday: "Mon", day: 23 }. */
export function dayHead(date: IsoDate): { weekday: string; day: number } {
  const { d, day } = parts(date);
  return { weekday: weekdayShort.format(d), day };
}

/** "Tue, Nov 24". */
export function formatDayLong(date: IsoDate): string {
  const { d, day, mon } = parts(date);
  return `${weekdayShort.format(d)}, ${mon} ${day}`;
}
