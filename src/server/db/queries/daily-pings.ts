import { dailyPings } from "../schema";
import type { DbOrTx } from "./types";

/** Atomically claims local-date reminders; concurrent or retried cron calls cannot duplicate DMs. */
export async function claimDailyPingRows(
  db: DbOrTx,
  rows: ReadonlyArray<{ userId: string; pingDate: string }>,
): Promise<string[]> {
  if (rows.length === 0) return [];
  const inserted = await db
    .insert(dailyPings)
    .values([...rows])
    .onConflictDoNothing()
    .returning({ userId: dailyPings.userId });
  return inserted.map((row) => row.userId);
}
