import type { ListCheckinsForDate, SetCheckinChannelTs } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listCheckinRows, updateCheckinChannelTs } from "@/server/db/queries/checkins";
import { toCheckinView } from "./checkin-view";
import { InvalidInputError } from "./errors";
import { isManagerOrAdmin } from "./rbac";
import { assertIsoDate, isRowId } from "./validation";

/**
 * Contract ListCheckinsForDate (Stream B, read-only). manager/admin → every active
 * user's check-in for the date; member → only their own. Never touches time_entries.
 */
export const listCheckinsForDate: ListCheckinsForDate = async (actor, date) => {
  assertIsoDate(date);
  const rows = await listCheckinRows(getDb(), date, isManagerOrAdmin(actor) ? undefined : actor.userId);
  return rows.map(toCheckinView);
};

/**
 * Contract SetCheckinChannelTs: system call (Slack layer, after the channel broadcast).
 * Writes daily_checkins.channel_message_ts for user+date; no row → no-op. Stream B only.
 */
export const setCheckinChannelTs: SetCheckinChannelTs = async (userId, checkinDate, ts) => {
  assertIsoDate(checkinDate, "checkinDate");
  if (ts.trim() === "") throw InvalidInputError.field("ts", "Slack message ts is required");
  if (!isRowId(userId)) return; // cannot match a row → no-op, per contract
  await updateCheckinChannelTs(getDb(), userId, checkinDate, ts);
};
