import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { HolidayView, IsoDate, ProjectView } from "@/contracts";
import { companyHolidays, projects, type ProjectInsert } from "../schema";
import type { DbOrTx } from "./types";

const projectColumns = {
  id: projects.id,
  name: projects.name,
  code: projects.code,
  monthlyHourCap: projects.monthlyHourCap,
  isBillable: projects.isBillable,
  isActive: projects.isActive,
};

/** Projects sorted by name; archived ones only when asked. */
export async function listProjectViews(db: DbOrTx, includeArchived: boolean): Promise<ProjectView[]> {
  const query = db.select(projectColumns).from(projects);
  return (includeArchived ? query : query.where(eq(projects.isActive, true))).orderBy(
    asc(projects.name),
    asc(projects.id),
  );
}

export type ProjectValues = Omit<ProjectInsert, "id">;

export async function insertProject(db: DbOrTx, values: ProjectValues): Promise<ProjectView> {
  const [row] = await db.insert(projects).values(values).returning(projectColumns);
  return row;
}

/** Returns undefined when no project has `id`. */
export async function updateProject(db: DbOrTx, id: string, values: ProjectValues): Promise<ProjectView | undefined> {
  const [row] = await db.update(projects).set(values).where(eq(projects.id, id)).returning(projectColumns);
  return row;
}

const holidayColumns = {
  id: companyHolidays.id,
  holidayDate: companyHolidays.holidayDate,
  name: companyHolidays.name,
};

/** Company holidays in [start, end], by date. */
export async function listHolidayViews(db: DbOrTx, start: IsoDate, end: IsoDate): Promise<HolidayView[]> {
  return db
    .select(holidayColumns)
    .from(companyHolidays)
    .where(and(gte(companyHolidays.holidayDate, start), lte(companyHolidays.holidayDate, end)))
    .orderBy(asc(companyHolidays.holidayDate));
}

export async function insertHoliday(db: DbOrTx, holidayDate: IsoDate, name: string): Promise<HolidayView> {
  const [row] = await db.insert(companyHolidays).values({ holidayDate, name }).returning(holidayColumns);
  return row;
}

/** True when a row was deleted. */
export async function deleteHoliday(db: DbOrTx, id: string): Promise<boolean> {
  const rows = await db.delete(companyHolidays).where(eq(companyHolidays.id, id)).returning({ id: companyHolidays.id });
  return rows.length > 0;
}
