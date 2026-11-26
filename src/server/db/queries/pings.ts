import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { IsoDate } from "@/contracts";
import { companyHolidays, dailyPings, timeEntries, users } from "../schema";
import type { DbOrTx } from "./types";

export interface PingUserRow {
  userId: string;
  slackUserId: string;
  fullName: string;
  timezone: string;
}

export async function listActivePingUsers(db: DbOrTx): Promise<PingUserRow[]> {
  return db
    .select({ userId: users.id, slackUserId: users.slackUserId, fullName: users.fullName, timezone: users.timezone })
    .from(users)
    .where(eq(users.isActive, true));
}

export async function listHolidayDates(db: DbOrTx, start: IsoDate, end: IsoDate): Promise<IsoDate[]> {
  const rows = await db
    .select({ date: companyHolidays.holidayDate })
    .from(companyHolidays)
    .where(and(gte(companyHolidays.holidayDate, start), lte(companyHolidays.holidayDate, end)));
  return rows.map((r) => r.date);
}

/** Non-work (vacation/sick/holiday) rows of these users on these dates. */
export async function listOffDays(
  db: DbOrTx,
  userIds: readonly string[],
  dates: readonly IsoDate[],
): Promise<Array<{ userId: string; workDate: IsoDate }>> {
  if (userIds.length === 0 || dates.length === 0) return [];
  return db
    .selectDistinct({ userId: timeEntries.userId, workDate: timeEntries.workDate })
    .from(timeEntries)
    .where(
      and(
        inArray(timeEntries.userId, [...userIds]),
        inArray(timeEntries.workDate, [...dates]),
        ne(timeEntries.entryType, "work"),
      ),
    );
}

/** A4 dedup: insert … on conflict do nothing; returns only the user ids newly claimed. */
export async function claimPingRows(
  db: DbOrTx,
  rows: ReadonlyArray<{ userId: string; pingDate: IsoDate }>,
): Promise<string[]> {
  if (rows.length === 0) return [];
  const inserted = await db
    .insert(dailyPings)
    .values([...rows])
    .onConflictDoNothing()
    .returning({ userId: dailyPings.userId });
  return inserted.map((r) => r.userId);
}
