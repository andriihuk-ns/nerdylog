import { and, asc, eq, gte, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import type { HolidayView, IsoDate } from "@/contracts";
import { companyHolidays, projects, users } from "../schema";
import type { DbOrTx } from "./types";

/** A project with its creator; the service adds members and `isMember` (A15). */
export interface ProjectRow {
  id: string;
  name: string;
  isActive: boolean;
  slackChannelId: string | null;
  createdBy: { userId: string; fullName: string } | null;
  statusPromptTime: string; // A16
  statusPromptOfficeId: string | null; // A16
  hasTimeEntries: boolean; // A16
}

// Explicit table names: inside a correlated subquery Drizzle may render ${projects.id} unqualified ("id"),
// which would then resolve to time_entries.id (see offices.ts).
const hasTimeEntries = sql<boolean>`exists(select 1 from "time_entries" te where te."project_id" = "projects"."id")`;

const projectRowColumns = {
  id: projects.id,
  name: projects.name,
  isActive: projects.isActive,
  slackChannelId: projects.slackChannelId,
  statusPromptTime: projects.statusPromptTime,
  statusPromptOfficeId: projects.statusPromptOfficeId,
  hasTimeEntries,
  creatorId: users.id,
  creatorName: users.fullName,
};

type RawProjectRow = Omit<ProjectRow, "createdBy"> & { creatorId: string | null; creatorName: string | null };

function toProjectRow({ creatorId, creatorName, ...rest }: RawProjectRow): ProjectRow {
  return { ...rest, createdBy: creatorId ? { userId: creatorId, fullName: creatorName ?? "" } : null };
}

/** Projects sorted by name; archived ones only when asked. */
export async function listProjectRows(db: DbOrTx, includeArchived: boolean): Promise<ProjectRow[]> {
  const rows = await db
    .select(projectRowColumns)
    .from(projects)
    .leftJoin(users, eq(users.id, projects.createdBy))
    .where(includeArchived ? undefined : eq(projects.isActive, true))
    .orderBy(asc(projects.name), asc(projects.id));
  return rows.map(toProjectRow);
}

export async function findProjectRow(db: DbOrTx, id: string): Promise<ProjectRow | undefined> {
  const [row] = await db
    .select(projectRowColumns)
    .from(projects)
    .leftJoin(users, eq(users.id, projects.createdBy))
    .where(eq(projects.id, id))
    .limit(1);
  return row ? toProjectRow(row) : undefined;
}

/** Undefined optional fields are left unchanged on update (and take the column default on insert). */
export interface ProjectValues {
  name: string;
  slackChannelId: string | null;
  isActive?: boolean;
  statusPromptTime?: string; // A16
  statusPromptOfficeId?: string | null; // A16
}

/** Returns the new id. */
export async function insertProject(db: DbOrTx, values: ProjectValues & { createdBy: string }): Promise<string> {
  const [row] = await db.insert(projects).values(values).returning({ id: projects.id });
  return row.id;
}

/** Returns false when no project has `id`. Never touches created_by. */
export async function updateProject(db: DbOrTx, id: string, values: ProjectValues): Promise<boolean> {
  const rows = await db.update(projects).set(values).where(eq(projects.id, id)).returning({ id: projects.id });
  return rows.length > 0;
}

export interface ProjectChannelRow {
  projectId: string;
  projectName: string;
  slackChannelId: string;
}

/** A11: active projects that have a Slack channel, by name. */
export async function listProjectChannelRows(db: DbOrTx): Promise<ProjectChannelRow[]> {
  const rows = await db
    .select({ projectId: projects.id, projectName: projects.name, slackChannelId: projects.slackChannelId })
    .from(projects)
    .where(and(eq(projects.isActive, true), isNotNull(projects.slackChannelId)))
    .orderBy(asc(projects.name), asc(projects.id));
  return rows.flatMap((r) => (r.slackChannelId ? [{ ...r, slackChannelId: r.slackChannelId }] : []));
}

const holidayColumns = {
  id: companyHolidays.id,
  officeId: companyHolidays.officeId,
  holidayDate: companyHolidays.holidayDate,
  name: companyHolidays.name,
};

/** Holidays in [start, end] (one office, or all), by date then office. */
export async function listHolidayViews(
  db: DbOrTx,
  start: IsoDate,
  end: IsoDate,
  officeId?: string,
): Promise<HolidayView[]> {
  const conditions: SQL[] = [gte(companyHolidays.holidayDate, start), lte(companyHolidays.holidayDate, end)];
  if (officeId) conditions.push(eq(companyHolidays.officeId, officeId));
  return db
    .select(holidayColumns)
    .from(companyHolidays)
    .where(and(...conditions))
    .orderBy(asc(companyHolidays.holidayDate), asc(companyHolidays.officeId));
}

export async function insertHoliday(db: DbOrTx, values: Omit<HolidayView, "id">): Promise<HolidayView> {
  const [row] = await db.insert(companyHolidays).values(values).returning(holidayColumns);
  return row;
}

/** Inserts rows, skipping (office, date) pairs that already exist. Returns how many were inserted. */
export async function insertHolidaysSkipExisting(db: DbOrTx, rows: ReadonlyArray<Omit<HolidayView, "id">>): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(companyHolidays)
    .values([...rows])
    .onConflictDoNothing({ target: [companyHolidays.officeId, companyHolidays.holidayDate] })
    .returning({ id: companyHolidays.id });
  return inserted.length;
}

/** The deleted holiday's office and date, or undefined when no row had that id. */
export async function deleteHoliday(
  db: DbOrTx,
  id: string,
): Promise<{ officeId: string; holidayDate: IsoDate } | undefined> {
  const [row] = await db
    .delete(companyHolidays)
    .where(eq(companyHolidays.id, id))
    .returning({ officeId: companyHolidays.officeId, holidayDate: companyHolidays.holidayDate });
  return row;
}

/** A15: holiday dates of one user's office in [start, end]; a user without an office has none. */
export async function listUserHolidayDates(db: DbOrTx, userId: string, start: IsoDate, end: IsoDate): Promise<IsoDate[]> {
  const rows = await db
    .select({ date: companyHolidays.holidayDate })
    .from(companyHolidays)
    .innerJoin(users, eq(users.officeId, companyHolidays.officeId))
    .where(and(eq(users.id, userId), gte(companyHolidays.holidayDate, start), lte(companyHolidays.holidayDate, end)))
    .orderBy(asc(companyHolidays.holidayDate));
  return rows.map((r) => r.date);
}

/** A15: holiday dates of the given offices in [start, end]. */
export async function listOfficeHolidayDates(
  db: DbOrTx,
  officeIds: readonly string[],
  start: IsoDate,
  end: IsoDate,
): Promise<Array<{ officeId: string; date: IsoDate }>> {
  if (officeIds.length === 0) return [];
  return db
    .select({ officeId: companyHolidays.officeId, date: companyHolidays.holidayDate })
    .from(companyHolidays)
    .where(
      and(
        inArray(companyHolidays.officeId, [...officeIds]),
        gte(companyHolidays.holidayDate, start),
        lte(companyHolidays.holidayDate, end),
      ),
    );
}
