import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { IsoDate } from "@/contracts";
import { dailyCheckins, users } from "../schema";
import type { DbOrTx } from "./types";

/** Stream B row joined with the author's display fields. Never used in hour math. */
export interface CheckinRow {
  userId: string;
  checkinDate: IsoDate;
  plannedToday: string;
  blockers: string;
  fullName: string;
  avatarUrl: string | null;
}

/** Stores the standup broadcast's Slack `ts`. No row → no-op. */
export async function updateCheckinChannelTs(
  db: DbOrTx,
  userId: string,
  checkinDate: IsoDate,
  ts: string,
): Promise<void> {
  await db
    .update(dailyCheckins)
    .set({ channelMessageTs: ts })
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, checkinDate)));
}

const checkinRowColumns = {
  userId: dailyCheckins.userId,
  checkinDate: dailyCheckins.checkinDate,
  plannedToday: dailyCheckins.plannedToday,
  blockers: dailyCheckins.blockers,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
};

/** A15 people page: one user's check-ins in [start, end] (archived users included), newest first. */
export async function listUserCheckinRows(db: DbOrTx, userId: string, start: IsoDate, end: IsoDate): Promise<CheckinRow[]> {
  return db
    .select(checkinRowColumns)
    .from(dailyCheckins)
    .innerJoin(users, eq(users.id, dailyCheckins.userId))
    .where(
      and(eq(dailyCheckins.userId, userId), gte(dailyCheckins.checkinDate, start), lte(dailyCheckins.checkinDate, end)),
    )
    .orderBy(desc(dailyCheckins.checkinDate));
}

/** Check-ins of active users on `date`, sorted by name. `onlyUserId` narrows to one author. */
export async function listCheckinRows(db: DbOrTx, date: IsoDate, onlyUserId?: string): Promise<CheckinRow[]> {
  const base = and(eq(dailyCheckins.checkinDate, date), eq(users.isActive, true));
  return db
    .select(checkinRowColumns)
    .from(dailyCheckins)
    .innerJoin(users, eq(users.id, dailyCheckins.userId))
    .where(onlyUserId ? and(base, eq(dailyCheckins.userId, onlyUserId)) : base)
    .orderBy(asc(users.fullName), asc(users.id));
}
