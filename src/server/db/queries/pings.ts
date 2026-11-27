import { and, eq, inArray, ne } from "drizzle-orm";
import type { IsoDate, Locale } from "@/contracts";
import { dailyPings, timeEntries, users } from "../schema";
import type { DbOrTx } from "./types";

export interface PingUserRow {
  userId: string;
  slackUserId: string;
  fullName: string;
  timezone: string;
  locale: Locale; // A14
  officeId: string | null; // A15: whose holidays apply; null = none
}

export async function listActivePingUsers(db: DbOrTx): Promise<PingUserRow[]> {
  return db
    .select({
      userId: users.id,
      slackUserId: users.slackUserId,
      fullName: users.fullName,
      timezone: users.timezone,
      locale: users.locale,
      officeId: users.officeId,
    })
    .from(users)
    .where(eq(users.isActive, true));
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
