import { and, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import type { EntryType, IsoDate } from "@/contracts";
import { timeEntries } from "../schema";
import type { DbOrTx } from "./types";

export interface MonthEntryRow {
  userId: string;
  workDate: IsoDate;
  hours: number;
  entryType: EntryType;
  projectId: string | null;
}

export interface EntryFilter {
  start: IsoDate;
  end: IsoDate;
  /** Restrict to these users; omit for all users. An empty list returns no rows. */
  userIds?: readonly string[];
  /** Restrict to these projects. */
  projectIds?: readonly string[];
}

/** Stream A rows in [start, end] with only the columns the rollup math needs. */
export async function listEntriesInRange(db: DbOrTx, filter: EntryFilter): Promise<MonthEntryRow[]> {
  if (filter.userIds?.length === 0 || filter.projectIds?.length === 0) return [];
  const conditions: SQL[] = [gte(timeEntries.workDate, filter.start), lte(timeEntries.workDate, filter.end)];
  if (filter.userIds) conditions.push(inArray(timeEntries.userId, [...filter.userIds]));
  if (filter.projectIds) conditions.push(inArray(timeEntries.projectId, [...filter.projectIds]));
  return db
    .select({
      userId: timeEntries.userId,
      workDate: timeEntries.workDate,
      hours: timeEntries.hours,
      entryType: timeEntries.entryType,
      projectId: timeEntries.projectId,
    })
    .from(timeEntries)
    .where(and(...conditions));
}

export interface PtoDateRow {
  workDate: IsoDate;
  entryType: "vacation" | "sick";
}

/** A9: one user's vacation and sick rows in [start, end] (duplicates kept; callers dedupe dates). */
export async function listUserPtoDates(
  db: DbOrTx,
  userId: string,
  start: IsoDate,
  end: IsoDate,
): Promise<PtoDateRow[]> {
  const rows = await db
    .select({ workDate: timeEntries.workDate, entryType: timeEntries.entryType })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.workDate, start),
        lte(timeEntries.workDate, end),
        inArray(timeEntries.entryType, ["vacation", "sick"]),
      ),
    );
  return rows.filter((r): r is PtoDateRow => r.entryType === "vacation" || r.entryType === "sick");
}
