import type { ListCheckinsForDate, ListCheckinsForUser, SetCheckinChannelTs } from "@/contracts";
import { getDb } from "@/server/db/client";
import { listCheckinRows, listUserCheckinRows, updateCheckinChannelTs } from "@/server/db/queries/checkins";
import { toCheckinView } from "./checkin-view";
import { InvalidInputError } from "./errors";
import { assertCanActOnUser, isManagerOrAdmin } from "./rbac";
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
 * Contract ListCheckinsForUser (A15 people page, Stream B read-only): one user's check-ins in
 * [from, to], newest first. member → only themselves; manager/admin → anyone. RangeError for bad dates.
 */
export const listCheckinsForUser: ListCheckinsForUser = async (actor, userId, from, to) => {
  assertIsoDate(from, "from");
  assertIsoDate(to, "to");
  assertCanActOnUser(actor, userId);
  if (!isRowId(userId) || from > to) return [];
  const rows = await listUserCheckinRows(getDb(), userId, from, to);
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
