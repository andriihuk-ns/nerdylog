import { z } from "zod";
import type { Actor, ExportRange, IsoDate } from "@/contracts";
import { addDays } from "./calendar";
import { ForbiddenError } from "./errors";
import { isManagerOrAdmin } from "./rbac";
import { assertIsoDate, parseInput } from "./validation";

/** Longest exportable range (inclusive days). Keeps one request bounded. */
export const MAX_EXPORT_DAYS = 366;

export interface ResolvedExportRange {
  from: IsoDate;
  to: IsoDate;
  /** Explicit users, or "active" = every active user (manager/admin default). */
  users: string[] | "active";
  projectIds?: string[];
}

const idListSchema = z.array(z.uuid()).max(500).optional();

/**
 * Pure RBAC + validation for exports (A5, PRD §2). Dates: RangeError when invalid,
 * reversed or longer than MAX_EXPORT_DAYS. Ids: InvalidInputError when not uuids.
 * member: userIds omitted → self; any other user → ForbiddenError.
 * manager/admin: userIds omitted → all active users; else exactly those users.
 */
export function resolveExportRange(actor: Actor, range: ExportRange): ResolvedExportRange {
  const from = assertIsoDate(range.from, "from");
  const to = assertIsoDate(range.to, "to");
  if (from > to) throw new RangeError("`from` must not be after `to`");
  if (addDays(from, MAX_EXPORT_DAYS - 1) < to) throw new RangeError(`Range exceeds ${MAX_EXPORT_DAYS} days`);
  const userIds = parseInput(idListSchema, range.userIds);
  const projectIds = parseInput(idListSchema, range.projectIds);

  let users: string[] | "active";
  if (isManagerOrAdmin(actor)) {
    users = userIds && userIds.length > 0 ? [...new Set(userIds)] : "active";
  } else {
    if (userIds?.some((id) => id !== actor.userId)) {
      throw new ForbiddenError("Members can only export their own time");
    }
    users = [actor.userId];
  }
  return {
    from,
    to,
    users,
    ...(projectIds && projectIds.length > 0 ? { projectIds: [...new Set(projectIds)] } : {}),
  };
}
