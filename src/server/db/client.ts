import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Server-only Drizzle client (amendment A5: connects with a role that bypasses RLS,
 * so services must enforce RBAC). Created lazily on first call; nothing connects at import.
 * Serverless-safe: small pool, short idle timeout, `prepare: false` for the Supabase
 * transaction pooler (port 6543), which does not support named prepared statements.
 */
let cached: { db: Db; sql: postgres.Sql } | undefined;

export function getDb(): Db {
  if (!cached) {
    const sql = postgres(serverEnv().DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    cached = { sql, db: drizzle({ client: sql, schema }) };
  }
  return cached.db;
}

/** Close the pool (scripts and tests only; route handlers should not call this). */
export async function closeDb(): Promise<void> {
  if (!cached) return;
  const { sql } = cached;
  cached = undefined;
  await sql.end({ timeout: 5 });
}
