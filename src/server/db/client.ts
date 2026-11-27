import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Server-only Drizzle client (amendment A5: connects with a role that bypasses RLS,
 * so services must enforce RBAC). Created lazily on first call; nothing connects at import.
 * Serverless-safe settings for the Supabase transaction pooler (port 6543):
 * - `prepare: false`: the pooler does not support named prepared statements.
 * - `max: 10`: pages fire up to ~10 queries at once. When concurrency exceeds the pool, postgres-js
 *   pipelines queries on a busy connection and, through the transaction pooler, Vercel requests
 *   stalled with queries stuck "active / ClientRead" (seen with 1, then again with 5 on /admin/people).
 * - `fetch_types: false`: skip the per-connection type lookup round-trip; Tempo only uses
 *   built-in types (text[] etc. are parsed without it).
 * - `max_lifetime`: recycle connections so a long-lived Fluid instance never keeps a stale one.
 */
let cached: { db: Db; sql: postgres.Sql } | undefined;

export function getDb(): Db {
  if (!cached) {
    const sql = postgres(serverEnv().DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
      prepare: false,
      fetch_types: false,
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
