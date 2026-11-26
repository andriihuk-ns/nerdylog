import { date, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Amendment A4: one morning ping per user per local date.
 * The cron inserts with ON CONFLICT DO NOTHING and only sends when a row was inserted.
 */
export const dailyPings = pgTable(
  "daily_pings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pingDate: date("ping_date", { mode: "string" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "daily_pings_pk", columns: [t.userId, t.pingDate] })],
);

export type DailyPingSelect = typeof dailyPings.$inferSelect;
export type DailyPingInsert = typeof dailyPings.$inferInsert;
