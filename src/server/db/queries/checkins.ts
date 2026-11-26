import { and, asc, eq } from "drizzle-orm";
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

/** Check-ins of active users on `date`, sorted by name. `onlyUserId` narrows to one author. */
export async function listCheckinRows(db: DbOrTx, date: IsoDate, onlyUserId?: string): Promise<CheckinRow[]> {
  const base = and(eq(dailyCheckins.checkinDate, date), eq(users.isActive, true));
  return db
    .select({
      userId: dailyCheckins.userId,
      checkinDate: dailyCheckins.checkinDate,
      plannedToday: dailyCheckins.plannedToday,
      blockers: dailyCheckins.blockers,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(dailyCheckins)
    .innerJoin(users, eq(users.id, dailyCheckins.userId))
    .where(onlyUserId ? and(base, eq(dailyCheckins.userId, onlyUserId)) : base)
    .orderBy(asc(users.fullName), asc(users.id));
}
