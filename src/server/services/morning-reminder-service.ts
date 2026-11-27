import type { ClaimMorningReminders, IsoDate } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listOfficeHolidayDates } from "@/server/db/queries/catalog";
import { claimDailyPingRows } from "@/server/db/queries/daily-pings";
import { listReminderEntryViews } from "@/server/db/queries/time-entry-views";
import { listMorningReminderUsers } from "@/server/db/queries/users";
import { addDays, previousBusinessDay } from "./calendar";
import { localClock } from "./project-prompt-decision";

const WINDOW_START = 9 * 3600 + 30 * 60;
const WINDOW_END = 11 * 3600;
const HOLIDAY_LOOKBACK_DAYS = 31;

/** A19: personal reminder window is [09:30, 11:00) in each user's local timezone. */
export const claimMorningReminders: ClaimMorningReminders = async (now) => {
  const db = getDb();
  const users = await listMorningReminderUsers(db);
  const candidates = users.flatMap((user) => {
    const clock = localClock(now, user.timezone);
    if (clock.dayOfWeek === 0 || clock.dayOfWeek === 6) return [];
    if (clock.secondsOfDay < WINDOW_START || clock.secondsOfDay >= WINDOW_END) return [];
    return [{ user, pingDate: clock.date }];
  });
  if (candidates.length === 0) return [];

  const dates = candidates.map((candidate) => candidate.pingDate).sort();
  const officeIds = [...new Set(candidates.flatMap(({ user }) => (user.officeId ? [user.officeId] : [])))];
  const holidayRows = await listOfficeHolidayDates(
    db,
    officeIds,
    addDays(dates[0], -HOLIDAY_LOOKBACK_DAYS),
    dates[dates.length - 1],
  );
  const holidaysByOffice = new Map<string, Set<IsoDate>>();
  for (const { officeId, date } of holidayRows) {
    holidaysByOffice.set(officeId, (holidaysByOffice.get(officeId) ?? new Set<IsoDate>()).add(date));
  }

  const scheduled = candidates.flatMap(({ user, pingDate }) => {
    const holidays = user.officeId ? holidaysByOffice.get(user.officeId) ?? new Set<IsoDate>() : new Set<IsoDate>();
    if (holidays.has(pingDate)) return [];
    return [{ user, pingDate, logDate: previousBusinessDay(pingDate, holidays) }];
  });
  if (scheduled.length === 0) return [];

  const activityDates = [...new Set(scheduled.flatMap(({ pingDate, logDate }) => [pingDate, logDate]))];
  const activity = await listReminderEntryViews(
    db,
    scheduled.map(({ user }) => user.userId),
    activityDates,
  );
  const entriesByUserDate = new Map<string, typeof activity>();
  for (const entry of activity) {
    const key = `${entry.userId}:${entry.workDate}`;
    entriesByUserDate.set(key, [...(entriesByUserDate.get(key) ?? []), entry]);
  }

  const eligible = scheduled.filter(({ user, pingDate }) =>
    !(entriesByUserDate.get(`${user.userId}:${pingDate}`) ?? []).some((entry) => entry.entryType !== "work"),
  );
  const claimed = new Set(
    await claimDailyPingRows(
      db,
      eligible.map(({ user, pingDate }) => ({ userId: user.userId, pingDate })),
    ),
  );

  return eligible.flatMap(({ user, pingDate, logDate }) => {
    if (!claimed.has(user.userId)) return [];
    const entries = (entriesByUserDate.get(`${user.userId}:${logDate}`) ?? []).map(({ entryType, projectName, hours, taskSummary }) => ({
      entryType,
      projectName,
      hours,
      taskSummary,
    }));
    return [{ userId: user.userId, slackUserId: user.slackUserId, locale: user.locale, pingDate, logDate, entries }];
  });
};
