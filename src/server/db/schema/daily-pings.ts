import { date, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Amendment A4: one morning ping per user per local date. A16 removed the personal morning DM;
 * the table is kept as history only (nothing writes it any more).
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
