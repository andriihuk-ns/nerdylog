import type { IsoDate, Locale } from "@/contracts";
import { addDays, dayOfWeek, isWeekend } from "@/server/services/calendar";
import { intlTag, t } from "./i18n";

export const DEFAULT_TIMEZONE = "Europe/Kyiv";

/** Today's date in an IANA timezone; unknown zones fall back to Europe/Kyiv. */
export function localIsoDate(now: Date, timezone: string): IsoDate {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try {
    return format(timezone);
  } catch {
    return format(DEFAULT_TIMEZONE);
  }
}

/** Monday of the ISO week containing `date`. */
export function mondayOf(date: IsoDate): IsoDate {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

/** Calendar days from `start` to `end` inclusive (negative when end < start). */
export function spanDays(start: IsoDate, end: IsoDate): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Business days in [start, end]: no weekends, no company holidays. */
export function businessDaysInRange(start: IsoDate, end: IsoDate, holidays: ReadonlySet<IsoDate>): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isWeekend(d) && !holidays.has(d)) days.push(d);
  }
  return days;
}

const utcDate = (date: IsoDate) => new Date(`${date}T00:00:00Z`);

function formatDate(date: IsoDate, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlTag(locale), { timeZone: "UTC", ...options }).format(utcDate(date));
}

/** "Wednesday" / "середа". */
export function weekdayName(date: IsoDate, locale: Locale = "en"): string {
  return formatDate(date, locale, { weekday: "long" });
}

/** Ukrainian weekdays in the accusative ("за середу"), which Intl does not provide. Sunday first. */
const UK_WEEKDAYS_ACCUSATIVE = ["неділю", "понеділок", "вівторок", "середу", "четвер", "пʼятницю", "суботу"];

/** Weekday for "Log {day}" / "Запиши роботу за {day}". */
export function weekdayForPrompt(date: IsoDate, locale: Locale): string {
  return locale === "uk" ? UK_WEEKDAYS_ACCUSATIVE[dayOfWeek(date)] : weekdayName(date, locale);
}

/** "Wednesday 25 November" / "середа, 25 листопада". */
export function longDate(date: IsoDate, locale: Locale = "en"): string {
  return formatDate(date, locale, { weekday: "long", day: "numeric", month: "long" });
}

/** "25 Dec" / "25 груд.". */
export function shortDate(date: IsoDate, locale: Locale = "en"): string {
  return formatDate(date, locale, { day: "numeric", month: "short" });
}

/** "November" / "листопад" for "2026-11". */
export function monthName(month: string, locale: Locale = "en"): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  return formatDate(`${month}-01`, locale, { month: "long" });
}

/** Locale number: "2.5" (en) / "2,5" (uk). No grouping (hours never reach 1000). */
export function formatNumber(n: number, locale: Locale = "en", fractionDigits: { min?: number; max?: number } = {}): string {
  return new Intl.NumberFormat(intlTag(locale), {
    useGrouping: false,
    minimumFractionDigits: fractionDigits.min ?? 0,
    maximumFractionDigits: fractionDigits.max ?? 2,
  }).format(n);
}

/** Design system: hours as `4h` / `2.5h`; uk `2,5 год`. Shared channel posts call this without a locale (English). */
export function formatHours(hours: number, locale: Locale = "en"): string {
  return t(locale, "unit.hours", { n: formatNumber(hours, locale) });
}

/** Cap telemetry: one decimal, `32.0h` / `32,0 год`. */
export function formatHoursFixed(hours: number, locale: Locale = "en"): string {
  return t(locale, "unit.hours", { n: formatNumber(hours, locale, { min: 1, max: 1 }) });
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}
