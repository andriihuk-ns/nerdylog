import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import type { EntryType, IsoDate, TimeEntryView } from "@/contracts";
import { projects, timeEntries, type TimeEntryInsert } from "../schema";
import type { DbOrTx } from "./types";

/** Columns for the contract TimeEntryView (project name via left join; null for PTO rows). */
const viewColumns = {
  id: timeEntries.id,
  userId: timeEntries.userId,
  projectId: timeEntries.projectId,
  projectName: projects.name,
  workDate: timeEntries.workDate,
  hours: timeEntries.hours,
  entryType: timeEntries.entryType,
  taskSummary: timeEntries.taskSummary,
  ticketRefs: timeEntries.ticketRefs,
  source: timeEntries.source,
};

/** One user's entries in [start, end], ordered by date then project name. */
export async function listEntryViews(
  db: DbOrTx,
  userId: string,
  start: IsoDate,
  end: IsoDate,
): Promise<TimeEntryView[]> {
  return db
    .select(viewColumns)
    .from(timeEntries)
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(and(eq(timeEntries.userId, userId), gte(timeEntries.workDate, start), lte(timeEntries.workDate, end)))
    .orderBy(asc(timeEntries.workDate), asc(projects.name), asc(timeEntries.id));
}

/** All entries for the reminder candidates and dates, ordered for concise personal summaries. */
export async function listReminderEntryViews(
  db: DbOrTx,
  userIds: readonly string[],
  dates: readonly IsoDate[],
): Promise<TimeEntryView[]> {
  if (userIds.length === 0 || dates.length === 0) return [];
  return db
    .select(viewColumns)
    .from(timeEntries)
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(and(inArray(timeEntries.userId, [...userIds]), inArray(timeEntries.workDate, [...dates])))
    .orderBy(asc(timeEntries.workDate), asc(projects.name), asc(timeEntries.id));
}

export async function findEntryView(db: DbOrTx, id: string): Promise<TimeEntryView | undefined> {
  const [row] = await db
    .select(viewColumns)
    .from(timeEntries)
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(eq(timeEntries.id, id))
    .limit(1);
  return row;
}

export async function insertEntry(db: DbOrTx, row: TimeEntryInsert): Promise<string> {
  const [inserted] = await db.insert(timeEntries).values(row).returning({ id: timeEntries.id });
  return inserted.id;
}

export type EntryPatch = Pick<TimeEntryInsert, "projectId" | "hours" | "taskSummary" | "ticketRefs">;

export async function updateEntry(db: DbOrTx, id: string, patch: EntryPatch): Promise<void> {
  await db.update(timeEntries).set(patch).where(eq(timeEntries.id, id));
}

export async function deleteEntry(db: DbOrTx, id: string): Promise<void> {
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

/** Delete one user's rows on `date`; restricted to `types` when given. */
export async function deleteDayEntries(
  db: DbOrTx,
  userId: string,
  date: IsoDate,
  types?: readonly EntryType[],
): Promise<void> {
  const conditions: SQL[] = [eq(timeEntries.userId, userId), eq(timeEntries.workDate, date)];
  if (types) conditions.push(inArray(timeEntries.entryType, [...types]));
  await db.delete(timeEntries).where(and(...conditions));
}
