/**
 * Supabase JWT simulation for RLS tests. `asAuth` runs `fn` inside a savepoint with
 * `SET LOCAL ROLE authenticated` and `request.jwt.claims` = { sub, role }. The savepoint is
 * always rolled back, so the role switch and any writes made by `fn` never escape it.
 */
import type { Tx } from "@/server/db/queries/types";
import { inSavepoint, pgError, sql } from "./db";

async function enterAuth(sp: Tx, sub: string | null, role: "authenticated" | "anon"): Promise<void> {
  const claims = JSON.stringify(sub ? { sub, role } : { role });
  await sp.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
  await sp.execute(role === "anon" ? sql`set local role anon` : sql`set local role authenticated`);
}

export async function asAuth<T>(tx: Tx, sub: string | null, fn: (sp: Tx) => Promise<T>): Promise<T> {
  const outcome = await inSavepoint(tx, async (sp) => {
    await enterAuth(sp, sub, "authenticated");
    return fn(sp);
  });
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

export async function asAnon<T>(tx: Tx, fn: (sp: Tx) => Promise<T>): Promise<T> {
  const outcome = await inSavepoint(tx, async (sp) => {
    await enterAuth(sp, null, "anon");
    return fn(sp);
  });
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

/**
 * Simulates the standard Supabase Data-API grants INSIDE the test transaction (GRANT is
 * transactional, so the rollback reverts it). The dev DB as deployed grants anon/authenticated
 * no SELECT/INSERT/UPDATE/DELETE at all, which makes every policy unreachable; this lets the
 * policy logic itself be verified.
 */
export async function grantDataApi(tx: Tx): Promise<void> {
  await tx.execute(sql`grant select, insert, update, delete on all tables in schema public to authenticated, anon`);
}

/**
 * Expects `fn` (as the given auth user) to be rejected with SQLSTATE 42501.
 * `kind: "policy"` additionally requires the row-level-security message (not a missing grant).
 */
export async function expectRlsDenied(
  tx: Tx,
  sub: string,
  fn: (sp: Tx) => Promise<unknown>,
  kind: "policy" | "privilege" = "policy",
): Promise<void> {
  const outcome = await inSavepoint(tx, async (sp) => {
    await enterAuth(sp, sub, "authenticated");
    return fn(sp);
  });
  if (outcome.ok) throw new Error("expected RLS denial (42501), statement succeeded");
  const { code, message = "" } = pgError(outcome.error);
  const want = kind === "policy" ? "row-level security" : "permission denied";
  if (code !== "42501" || !message.includes(want)) {
    throw new Error(`expected 42501 (${want}), got ${code ?? "?"}: ${message}`, { cause: outcome.error });
  }
}
