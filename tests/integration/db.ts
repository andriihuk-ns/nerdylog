/**
 * Real-database helpers for *.db.test.ts. Every test body runs inside `withRollback`, which
 * opens a transaction and ALWAYS rolls it back, so the dev database is left exactly as found.
 *
 * Service tests mock `@/server/db/client` so `getDb()` returns `activeTx()`; services that
 * call `db.transaction(...)` then nest as savepoints inside the test transaction.
 */
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "@/server/db/client";
import type { Tx } from "@/server/db/queries/types";
import * as schema from "@/server/db/schema";

class RollbackSentinel extends Error {
  constructor() {
    super("rollback");
    this.name = "RollbackSentinel";
  }
}

let conn: { sql: postgres.Sql; db: Db } | undefined;
let active: Tx | undefined;

function testDb(): Db {
  if (!conn) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const client = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 15, onnotice: () => {} });
    conn = { sql: client, db: drizzle({ client, schema }) };
  }
  return conn.db;
}

/** The transaction of the currently running `withRollback` (used by the getDb mock). */
export function activeTx(): Tx {
  if (!active) throw new Error("activeTx(): no withRollback transaction is open");
  return active;
}

/** Runs `fn` in a transaction that is always rolled back; returns `fn`'s result. */
export async function withRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: { value: T } | undefined;
  try {
    await testDb().transaction(async (tx) => {
      active = tx;
      try {
        result = { value: await fn(tx) };
      } finally {
        active = undefined;
      }
      throw new RollbackSentinel();
    });
  } catch (error) {
    if (!(error instanceof RollbackSentinel)) throw error;
  }
  if (!result) throw new Error("withRollback: no result");
  return result.value;
}

/**
 * Runs `fn` inside a savepoint that is always rolled back. Use it for statements that are
 * expected to fail (the outer transaction stays usable) and for `SET LOCAL` scopes.
 * Returns the value, or the error thrown by `fn`.
 */
export async function inSavepoint<T>(
  tx: Tx,
  fn: (sp: Tx) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown } | undefined;
  try {
    await tx.transaction(async (sp) => {
      try {
        outcome = { ok: true, value: await fn(sp) };
      } catch (error) {
        outcome = { ok: false, error };
      }
      throw new RollbackSentinel();
    });
  } catch (error) {
    if (!(error instanceof RollbackSentinel)) throw error;
  }
  if (!outcome) throw new Error("inSavepoint: no outcome");
  return outcome;
}

/** Postgres error fields, found anywhere in the `cause` chain (DrizzleQueryError wraps PostgresError). */
export function pgError(error: unknown): { code?: string; constraint?: string; message?: string } {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const e = current as { code?: unknown; constraint_name?: unknown; message?: unknown; cause?: unknown };
    if (typeof e.code === "string") {
      return {
        code: e.code,
        constraint: typeof e.constraint_name === "string" ? e.constraint_name : undefined,
        message: typeof e.message === "string" ? e.message : undefined,
      };
    }
    current = e.cause;
  }
  return {};
}

/** Expects `stmt` to fail with SQLSTATE `code` (and `constraint`, when given). */
export async function expectPgFailure(tx: Tx, stmt: (sp: Tx) => Promise<unknown>, code: string, constraint?: string) {
  const outcome = await inSavepoint(tx, stmt);
  if (outcome.ok) throw new Error(`expected SQLSTATE ${code}, statement succeeded`);
  const pg = pgError(outcome.error);
  if (pg.code !== code || (constraint !== undefined && pg.constraint !== constraint)) {
    throw new Error(`expected ${code}/${constraint ?? "*"}, got ${pg.code ?? "?"}/${pg.constraint ?? "?"}`, {
      cause: outcome.error,
    });
  }
}

export async function execRows<T>(tx: Tx, query: SQL): Promise<T[]> {
  return (await tx.execute(query)) as unknown as T[];
}

export const PUBLIC_TABLES = {
  users: schema.users,
  projects: schema.projects,
  time_entries: schema.timeEntries,
  daily_checkins: schema.dailyCheckins,
  company_holidays: schema.companyHolidays,
  slack_submissions: schema.slackSubmissions,
  daily_pings: schema.dailyPings,
  app_settings: schema.appSettings,
} as const;

/** Row counts of the 8 public tables, read outside any test transaction. */
export async function publicTableCounts(db: Db | Tx = testDb()): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [name, table] of Object.entries(PUBLIC_TABLES)) {
    counts[name] = await db.$count(table);
  }
  return counts;
}

export async function closeTestDb(): Promise<void> {
  if (!conn) return;
  const { sql: client } = conn;
  conn = undefined;
  await client.end({ timeout: 5 });
}

export { sql };
