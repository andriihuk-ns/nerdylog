import { TZDate } from "@date-fns/tz";
import type { IsoDate, PingTarget } from "@/contracts";
import { previousBusinessDay } from "./calendar";
import { isValidTimeZone } from "./validation";

/**
 * Pure morning-ping rules (amendment A4, FR-SLACK-01). No DB, no clock: `now` is passed in.
 * The cron runs every 15 minutes; each user is due once per local weekday in [09:30, 09:45).
 */

export const DEFAULT_TIMEZONE = "Europe/Kyiv";
export const PING_WINDOW_START_SEC = 9 * 3600 + 30 * 60; // 09:30:00 inclusive
export const PING_WINDOW_END_SEC = 9 * 3600 + 45 * 60; // 09:45:00 exclusive

export interface LocalClock {
  /** Effective IANA zone (stored zone, or the default when it is unknown). */
  timezone: string;
  date: IsoDate;
  secondsOfDay: number;
  /** 0 = Sunday … 6 = Saturday, in the user's zone. */
  dayOfWeek: number;
}

export type PingDecision = "due" | "outside_window" | "weekend" | "holiday" | "pto";

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock reading of `now` in `timezone` (DST-aware via @date-fns/tz). */
export function localClock(now: Date, timezone: string): LocalClock {
  const tz = isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const d = new TZDate(now.getTime(), tz);
  return {
    timezone: tz,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    secondsOfDay: d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(),
    dayOfWeek: d.getDay(),
  };
}

export function inPingWindow(clock: LocalClock): boolean {
  return clock.secondsOfDay >= PING_WINDOW_START_SEC && clock.secondsOfDay < PING_WINDOW_END_SEC;
}

/**
 * Is this user due for today's ping? Checks run cheapest first; the reason helps logs/tests.
 * `holidays` = company holidays; `offDays` = this user's PTO dates (vacation/sick/holiday rows).
 */
export function pingDecision(
  clock: LocalClock,
  holidays: ReadonlySet<IsoDate>,
  offDays: ReadonlySet<IsoDate>,
): PingDecision {
  if (!inPingWindow(clock)) return "outside_window";
  if (clock.dayOfWeek === 0 || clock.dayOfWeek === 6) return "weekend";
  if (holidays.has(clock.date)) return "holiday";
  if (offDays.has(clock.date)) return "pto";
  return "due";
}

export interface PingUser {
  userId: string;
  slackUserId: string;
  fullName: string;
  timezone: string;
}

export interface PingCandidate {
  user: PingUser;
  clock: LocalClock;
}

/** Stage 1 (before any holiday/PTO lookup): users in the window on a local weekday. */
export function windowCandidates(now: Date, users: readonly PingUser[]): PingCandidate[] {
  const none = new Set<IsoDate>();
  return users
    .map((user) => ({ user, clock: localClock(now, user.timezone) }))
    .filter((c) => pingDecision(c.clock, none, none) === "due");
}

/** Stage 2: drop holiday/PTO users and attach the log date (previous business day). */
export function selectPingTargets(
  candidates: readonly PingCandidate[],
  holidays: ReadonlySet<IsoDate>,
  offDaysByUser: ReadonlyMap<string, ReadonlySet<IsoDate>>,
): PingTarget[] {
  const none = new Set<IsoDate>();
  return candidates
    .filter((c) => pingDecision(c.clock, holidays, offDaysByUser.get(c.user.userId) ?? none) === "due")
    .map(({ user, clock }) => ({
      userId: user.userId,
      slackUserId: user.slackUserId,
      fullName: user.fullName,
      timezone: clock.timezone,
      localDate: clock.date,
      logDate: previousBusinessDay(clock.date, holidays),
    }));
}
