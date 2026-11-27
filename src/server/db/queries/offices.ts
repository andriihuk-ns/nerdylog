import { asc, count, eq, sql } from "drizzle-orm";
import type { OfficeView } from "@/contracts";
import { companyHolidays, offices, users } from "../schema";
import { getSetting, SETTING_KEYS, upsertSetting } from "./settings";
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

/** A30: offices in the saved order; ones not in it (new offices) follow, keeping their input order. */
export function applyOfficeOrder<T extends { id: string }>(rows: T[], order: readonly string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
}

/** Stored as a JSON array of office ids; anything unreadable means "no saved order". */
export function parseOfficeOrder(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** A15: offices with how many users (active or archived) belong to each. A30: in the admin's order, else by code. */
export async function listOfficeViews(db: DbOrTx): Promise<OfficeView[]> {
  const [rows, order] = await Promise.all([
    db.select(officeColumns).from(offices).orderBy(asc(offices.code)),
    getSetting(db, SETTING_KEYS.officeOrder),
  ]);
  return applyOfficeOrder(rows, parseOfficeOrder(order));
}

/** A30: replaces the saved office order. */
export async function saveOfficeOrder(db: DbOrTx, ids: string[]): Promise<void> {
  await upsertSetting(db, SETTING_KEYS.officeOrder, JSON.stringify(ids));
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
