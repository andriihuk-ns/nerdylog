import type { IsoDate } from "@/contracts";
import { dayHead, formatDayLong, formatMonth, formatShortRange, formatWeekRange } from "./dates";
import { formatCount, formatDays, formatHours, formatPercent } from "./format";

/** A14: the format helpers bound to one locale ("2,5", "Пн", "Листопад 2026" in uk). */
export function localeFormat(locale: string) {
  return {
    hours: (n: number) => formatHours(n, locale),
    days: (n: number) => formatDays(n, locale),
    count: (n: number) => formatCount(n, locale),
    percent: formatPercent,
    dayLong: (d: IsoDate) => formatDayLong(d, locale),
    dayHead: (d: IsoDate) => dayHead(d, locale),
    weekRange: (start: IsoDate, end: IsoDate) => formatWeekRange(start, end, locale),
    shortRange: (start: IsoDate, end: IsoDate) => formatShortRange(start, end, locale),
    month: (month: string) => formatMonth(month, locale),
  };
}

export type LocaleFormat = ReturnType<typeof localeFormat>;
