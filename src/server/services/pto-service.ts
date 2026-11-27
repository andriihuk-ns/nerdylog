import type { Actor, GetPtoBalance } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listUserPtoDates } from "@/server/db/queries/time-entries";
import { findPtoAllowance } from "@/server/db/queries/users";
import { ForbiddenError, NotFoundError } from "./errors";
import { computePtoBalance, yearRange } from "./pto-balance";
import { canViewTeam } from "./rollup-service";

/** Amendment A5: members read only their own balance; managers/admins read anyone's. */
export function assertCanReadUser(actor: Actor, userId: string): void {
  if (actor.userId !== userId && !canViewTeam(actor)) {
    throw new ForbiddenError("Members can only read their own PTO balance");
  }
}

/**
 * Contract GetPtoBalance (A9). Throws ForbiddenError (A5), RangeError for a bad year,
 * NotFoundError for an unknown user. Archived users are still readable by managers.
 */
export const getPtoBalance: GetPtoBalance = async (actor, userId, year) => {
  assertCanReadUser(actor, userId);
  const { start, end } = yearRange(year);
  const db = getDb();
  const user = await findPtoAllowance(db, userId);
  if (!user) throw new NotFoundError("User not found");
  const rows = await listUserPtoDates(db, userId, start, end);
  return computePtoBalance(userId, year, user.allowanceDays, rows, user.sickAllowanceDays);
};
