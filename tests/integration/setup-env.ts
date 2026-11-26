/**
 * Setup for `npm run test:db` (vitest.db.config.mts). Runs before every *.db.test.ts file.
 *
 * 1. Loads `.env.local` through dotenv (quiet: nothing is printed; values are never logged).
 * 2. Refuses to run unless DATABASE_URL points at a Supabase pooler host or a local Postgres.
 *    This is a guard by CONVENTION ONLY: the production database is also reachable through
 *    `*.pooler.supabase.com`, so the host check cannot tell dev from prod. The real protection
 *    is that only the dev DATABASE_URL lives in `.env.local`, and that every test runs inside a
 *    transaction that is rolled back (tests/integration/db.ts → withRollback).
 * 3. Leak check: row counts of all public tables are taken before each test file and must be
 *    identical afterwards. (The dev DB now holds real data, so "empty" is no longer the baseline.)
 */
import { config } from "dotenv";
import { afterAll, beforeAll } from "vitest";

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

let baseline: Record<string, number> = {};

beforeAll(async () => {
  const { publicTableCounts } = await import("./db");
  baseline = await publicTableCounts();
});

afterAll(async () => {
  const { closeTestDb, publicTableCounts } = await import("./db");
  try {
    const counts = await publicTableCounts();
    const changed = Object.entries(counts).filter(([table, n]) => n !== (baseline[table] ?? 0));
    if (changed.length > 0) {
      const diff = Object.fromEntries(changed.map(([t, n]) => [t, { before: baseline[t] ?? 0, after: n }]));
      throw new Error(`test:db leak check failed, row counts changed: ${JSON.stringify(diff)}`);
    }
    console.info(`[test:db] leak check ok: ${Object.keys(counts).length} public tables unchanged`);
  } finally {
    await closeTestDb();
  }
});
