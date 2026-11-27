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

/** Fallback only: pages pass the actor's `profile.timezone` (A12). */
function formatToday(timeZone: string, now: Date): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Today as "YYYY-MM-DD" in an IANA timezone; an unknown zone falls back to DEFAULT_TIMEZONE. */
export function todayIn(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): IsoDate {
  try {
    return formatToday(timeZone, now);
  } catch {
    return formatToday(DEFAULT_TIMEZONE, now);
  }
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

/*
 * A14: labels use Intl with the active locale ("en" | "uk"). Dates are UTC midnights, so the
 * formatter runs in UTC. ICU versions differ in the spaces they emit (thin around range dashes,
 * no-break before uk "р."); range labels normalise them so server and browser output match.
 */
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(opts)}`;
  let df = dateFormats.get(key);
  if (!df) {
    df = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts });
    dateFormats.set(key, df);
  }
  return df;
}

const NO_BREAK_SPACES = /[\u00a0\u202f]/g;
const utc = (date: IsoDate) => new Date(toUtcMs(date));
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** en "Nov 23 – 29, 2026", "Nov 30 – Dec 6, 2026"; uk "23–29 лист. 2026 р.". */
export function formatWeekRange(start: IsoDate, end: IsoDate, locale = "en"): string {
  return fmt(locale, { ...SHORT_DATE, year: "numeric" })
    .formatRange(utc(start), utc(end))
    .replace(/\u2009/g, " ")
    .replace(NO_BREAK_SPACES, " ");
}

/** Month-week caption: en "Nov 1–2", "Nov 30"; uk "1–2 лист.". */
export function formatShortRange(start: IsoDate, end: IsoDate, locale = "en"): string {
  const f = fmt(locale, SHORT_DATE);
  if (start === end) return f.format(utc(start));
  return f.formatRange(utc(start), utc(end)).replace(/\u2009/g, "").replace(NO_BREAK_SPACES, " ");
}

/** en "November 2026", uk "Листопад 2026" (stand-alone month name, no "р."). */
export function formatMonth(month: string, locale = "en"): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return `${capitalize(fmt(locale, { month: "long" }).format(d))} ${d.getUTCFullYear()}`;
}

/** Column head parts: en { weekday: "Mon", day: 23 }, uk { weekday: "Пн", day: 23 }. */
export function dayHead(date: IsoDate, locale = "en"): { weekday: string; day: number } {
  const d = utc(date);
  return { weekday: capitalize(fmt(locale, { weekday: "short" }).format(d)), day: d.getUTCDate() };
}

/** en "Tue, Nov 24", uk "Вт, 24 лист.". */
export function formatDayLong(date: IsoDate, locale = "en"): string {
  return capitalize(fmt(locale, { weekday: "short", ...SHORT_DATE }).format(utc(date)));
}
