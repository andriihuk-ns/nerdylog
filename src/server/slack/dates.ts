import type { IsoDate } from "@/contracts";
import { addDays, dayOfWeek, isWeekend } from "@/server/services/calendar";

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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function weekdayName(date: IsoDate): string {
  return WEEKDAYS[dayOfWeek(date)];
}

/** "Dec 25" */
export function shortDate(date: IsoDate): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** "November" for "2026-11". */
export function monthName(month: string): string {
  return MONTHS_LONG[Number(month.slice(5, 7)) - 1] ?? month;
}

/** Design system: hours as `4h` / `2.5h`. */
export function formatHours(hours: number): string {
  return `${Math.round(hours * 100) / 100}h`;
}

/** Cap telemetry: one decimal, `32.0h`. */
export function formatHoursFixed(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}
