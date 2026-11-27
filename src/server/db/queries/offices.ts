import { asc, count, eq, sql } from "drizzle-orm";
import type { OfficeView } from "@/contracts";
import { companyHolidays, offices, users } from "../schema";
import type { DbOrTx } from "./types";

// Explicit table names: inside a correlated subquery Drizzle may render ${offices.id} unqualified ("id"),
// which would then resolve to users.id and count 0.
const memberCount = sql<number>`(select count(*)::int from "users" u where u."office_id" = "offices"."id")`;

const officeColumns = { id: offices.id, code: offices.code, name: offices.name, timezone: offices.timezone, memberCount };

/** Writable office fields (A16 adds the IANA timezone). */
export interface OfficeValues {
  code: string;
  name: string;
  timezone: string;
}

/** A15: offices by code, with how many users (active or archived) belong to each. */
export async function listOfficeViews(db: DbOrTx): Promise<OfficeView[]> {
  return db.select(officeColumns).from(offices).orderBy(asc(offices.code));
}

export async function findOfficeView(db: DbOrTx, id: string): Promise<OfficeView | undefined> {
  const [row] = await db.select(officeColumns).from(offices).where(eq(offices.id, id)).limit(1);
  return row;
}

export async function officeExists(db: DbOrTx, id: string): Promise<boolean> {
  const rows = await db.select({ id: offices.id }).from(offices).where(eq(offices.id, id)).limit(1);
  return rows.length > 0;
}

/** Returns the new id. */
export async function insertOffice(db: DbOrTx, values: OfficeValues): Promise<string> {
  const [row] = await db.insert(offices).values(values).returning({ id: offices.id });
  return row.id;
}

/** Returns false when no office has `id`. */
export async function updateOffice(db: DbOrTx, id: string, values: OfficeValues): Promise<boolean> {
  const rows = await db.update(offices).set(values).where(eq(offices.id, id)).returning({ id: offices.id });
  return rows.length > 0;
}

/** Users and holidays that reference the office (both must be 0 before a delete). */
export async function countOfficeUsage(db: DbOrTx, id: string): Promise<{ members: number; holidays: number }> {
  const [[m], [h]] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.officeId, id)),
    db.select({ n: count() }).from(companyHolidays).where(eq(companyHolidays.officeId, id)),
  ]);
  return { members: m.n, holidays: h.n };
}

/** Returns false when no office has `id`. */
export async function deleteOfficeRow(db: DbOrTx, id: string): Promise<boolean> {
  const rows = await db.delete(offices).where(eq(offices.id, id)).returning({ id: offices.id });
  return rows.length > 0;
}
