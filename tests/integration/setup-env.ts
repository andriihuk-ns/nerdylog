/**
 * Setup for `npm run test:db` (vitest.db.config.mts). Runs before every *.db.test.ts file.
 *
 * 1. Loads `.env.local` through dotenv (quiet: nothing is printed; values are never logged).
 * 2. Refuses to run unless DATABASE_URL points at a Supabase pooler host or a local Postgres.
 *    This is a guard by CONVENTION ONLY: the production database is also reachable through
 *    `*.pooler.supabase.com`, so the host check cannot tell dev from prod. The real protection
 *    is that only the dev DATABASE_URL lives in `.env.local`, and that every test runs inside a
 *    transaction that is rolled back (tests/integration/db.ts → withRollback).
 * 3. After each test file: asserts that all 8 public tables are still empty (leak check).
 */
import { config } from "dotenv";
import { afterAll } from "vitest";

config({ path: ".env.local", quiet: true });

const ALLOWED_HOSTS = ["127.0.0.1", "localhost"];
const ALLOWED_HOST_SUFFIX = "pooler.supabase.com";

function assertSafeDatabaseUrl(raw: string | undefined): void {
  if (!raw) throw new Error("test:db: DATABASE_URL is not set (expected in .env.local)");
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    // Never echo the URL: it contains the password.
    throw new Error("test:db: DATABASE_URL is not a valid URL");
  }
  if (!ALLOWED_HOSTS.includes(host) && !host.includes(ALLOWED_HOST_SUFFIX)) {
    throw new Error(`test:db: refusing to run: DATABASE_URL host must contain "${ALLOWED_HOST_SUFFIX}" or be localhost`);
  }
}

assertSafeDatabaseUrl(process.env.DATABASE_URL);

afterAll(async () => {
  const { closeTestDb, publicTableCounts } = await import("./db");
  try {
    const counts = await publicTableCounts();
    const leaked = Object.entries(counts).filter(([, n]) => n !== 0);
    if (leaked.length > 0) {
      throw new Error(`test:db leak check failed, rows left behind: ${JSON.stringify(Object.fromEntries(leaked))}`);
    }
    console.info(`[test:db] leak check ok: ${Object.keys(counts).length} public tables, 0 rows`);
  } finally {
    await closeTestDb();
  }
});
