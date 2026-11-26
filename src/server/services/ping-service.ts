import type { ClaimMorningPings, IsoDate } from "@/contracts";
import { getDb } from "@/server/db/client";
import { claimPingRows, listActivePingUsers, listHolidayDates, listOffDays } from "@/server/db/queries/pings";
import { addDays } from "./calendar";
import { selectPingTargets, windowCandidates } from "./ping-decision";

/** Holiday lookback so previousBusinessDay can skip long holiday runs before a weekday. */
const HOLIDAY_LOOKBACK_DAYS = 31;

/**
 * Contract ClaimMorningPings (A4). System call (cron only, no actor).
 * 1. active users → those whose local time is in [09:30, 09:45) on a local weekday (pure);
 * 2. drop company holidays and users with a PTO row that local day (pure, on loaded sets);
 * 3. insert daily_pings ON CONFLICT DO NOTHING and return only rows this call inserted,
 *    so overlapping or retried cron runs never double-send.
 * A claimed ping is not released if the Slack DM later fails (at most one try per day).
 */
export const claimMorningPings: ClaimMorningPings = async (now) => {
  const db = getDb();
  const candidates = windowCandidates(now, await listActivePingUsers(db));
  if (candidates.length === 0) return [];

  const dates = [...new Set(candidates.map((c) => c.clock.date))].sort();
  const holidays = new Set(await listHolidayDates(db, addDays(dates[0], -HOLIDAY_LOOKBACK_DAYS), dates[dates.length - 1]));
  const offRows = await listOffDays(
    db,
    candidates.map((c) => c.user.userId),
    dates,
  );
  const offDaysByUser = new Map<string, Set<IsoDate>>();
  for (const row of offRows) {
    const set = offDaysByUser.get(row.userId) ?? new Set<IsoDate>();
    set.add(row.workDate);
    offDaysByUser.set(row.userId, set);
  }

  const targets = selectPingTargets(candidates, holidays, offDaysByUser);
  const claimed = new Set(
    await claimPingRows(
      db,
      targets.map((t) => ({ userId: t.userId, pingDate: t.localDate })),
    ),
  );
  return targets.filter((t) => claimed.has(t.userId));
};
