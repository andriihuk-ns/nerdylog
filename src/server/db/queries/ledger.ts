import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import type { EntrySource, EntryType, IsoDate } from "@/contracts";
import { projects, timeEntries, users } from "../schema";
import type { DbOrTx } from "./types";

/** One Stream A row joined with user and project names (ledger CSV and PDF input). */
export interface LedgerRow {
  workDate: IsoDate;
  userId: string;
  fullName: string;
  dailyNormHours: number;
  projectId: string | null;
  projectName: string | null;
  entryType: EntryType;
  hours: number;
  taskSummary: string;
  ticketRefs: string[];
  source: EntrySource;
}

export interface LedgerFilter {
  start: IsoDate;
  end: IsoDate;
  /** Explicit users, or "active" for every active user. An empty list returns no rows. */
  users: readonly string[] | "active";
  projectIds?: readonly string[];
}

/** Stream A rows with user + project names, ordered by date, employee, project. */
export async function listLedgerRows(db: DbOrTx, filter: LedgerFilter): Promise<LedgerRow[]> {
  if ((filter.users !== "active" && filter.users.length === 0) || filter.projectIds?.length === 0) return [];
  const conditions: SQL[] = [gte(timeEntries.workDate, filter.start), lte(timeEntries.workDate, filter.end)];
  conditions.push(
    filter.users === "active" ? eq(users.isActive, true) : inArray(timeEntries.userId, [...filter.users]),
  );
  if (filter.projectIds) conditions.push(inArray(timeEntries.projectId, [...filter.projectIds]));
  return db
    .select({
      workDate: timeEntries.workDate,
      userId: timeEntries.userId,
      fullName: users.fullName,
      dailyNormHours: users.dailyNormHours,
      projectId: timeEntries.projectId,
      projectName: projects.name,
      entryType: timeEntries.entryType,
      hours: timeEntries.hours,
      taskSummary: timeEntries.taskSummary,
      ticketRefs: timeEntries.ticketRefs,
      source: timeEntries.source,
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(and(...conditions))
    .orderBy(asc(timeEntries.workDate), asc(users.fullName), asc(projects.name), asc(timeEntries.id));
}

/** Names of the given projects (for the PDF header), sorted. */
export async function listProjectNames(db: DbOrTx, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(inArray(projects.id, [...ids]))
    .orderBy(asc(projects.name));
  return rows.map((r) => r.name);
}
