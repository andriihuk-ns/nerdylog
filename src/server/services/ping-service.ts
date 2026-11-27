import type { ClaimMorningPings, IsoDate } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listOfficeHolidayDates } from "@/server/db/queries/catalog";
import { claimPingRows, listActivePingUsers, listOffDays } from "@/server/db/queries/pings";
import { addDays } from "./calendar";
import { selectPingTargets, windowCandidates } from "./ping-decision";

/** Holiday lookback so previousBusinessDay can skip long holiday runs before a weekday. */
const HOLIDAY_LOOKBACK_DAYS = 31;

/**
 * Contract ClaimMorningPings (A4, window per A10). System call (pg_cron only, no actor).
 * 1. active users → those whose local time is in [09:30, 11:00) on a local weekday (pure);
 * 2. drop users on a holiday of their own office (A15) and users with a PTO row that local day;
 * 3. insert daily_pings ON CONFLICT DO NOTHING and return only rows this call inserted,
 *    so overlapping or retried cron runs never double-send.
 * A claimed ping is not released if the Slack DM later fails (at most one try per day).
 */
export const claimMorningPings: ClaimMorningPings = async (now) => {
  const db = getDb();
  const candidates = windowCandidates(now, await listActivePingUsers(db));
  if (candidates.length === 0) return [];

  const dates = [...new Set(candidates.map((c) => c.clock.date))].sort();
  const officeIds = [...new Set(candidates.flatMap((c) => (c.user.officeId ? [c.user.officeId] : [])))];
  const holidayRows = await listOfficeHolidayDates(
    db,
    officeIds,
    addDays(dates[0], -HOLIDAY_LOOKBACK_DAYS),
    dates[dates.length - 1],
  );
  const holidaysByOffice = groupDates(holidayRows.map((r) => ({ key: r.officeId, date: r.date })));
  const offRows = await listOffDays(
    db,
    candidates.map((c) => c.user.userId),
    dates,
  );
  const offDaysByUser = groupDates(offRows.map((r) => ({ key: r.userId, date: r.workDate })));

  const targets = selectPingTargets(candidates, holidaysByOffice, offDaysByUser);
  const claimed = new Set(
    await claimPingRows(
      db,
      targets.map((t) => ({ userId: t.userId, pingDate: t.localDate })),
    ),
  );
  return targets.filter((t) => claimed.has(t.userId));
};

function groupDates(rows: ReadonlyArray<{ key: string; date: IsoDate }>): Map<string, Set<IsoDate>> {
  const out = new Map<string, Set<IsoDate>>();
  for (const { key, date } of rows) {
    const set = out.get(key) ?? new Set<IsoDate>();
    set.add(date);
    out.set(key, set);
  }
  return out;
}
