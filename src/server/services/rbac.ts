import type { Actor } from "@/contracts";
import { ForbiddenError } from "./errors";

/**
 * Amendment A5 role checks, enforced in the service layer because Drizzle bypasses RLS.
 * PRD §2: managers and admins may act on teammates' rows; members only on their own.
 */

export function isManagerOrAdmin(actor: Actor): boolean {
  return actor.role === "manager" || actor.role === "admin";
}

/** member → only `userId === actor.userId`; manager/admin → anyone. */
export function assertCanActOnUser(actor: Actor, userId: string): void {
  if (actor.userId !== userId && !isManagerOrAdmin(actor)) {
    throw new ForbiddenError("Members can only access their own data");
  }
}

export function assertManagerOrAdmin(actor: Actor): void {
  if (!isManagerOrAdmin(actor)) throw new ForbiddenError("Requires role: manager | admin");
}

export function assertAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new ForbiddenError("Requires role: admin");
}
