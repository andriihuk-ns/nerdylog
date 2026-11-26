import { date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * PRD §5.2 `daily_checkins` (Stream B, reference-only standup context).
 * Never joined into hour, day or cap calculations. A6: one check-in per user per day.
 */
export const dailyCheckins = pgTable(
  "daily_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    checkinDate: date("checkin_date", { mode: "string" }).notNull(),
    plannedToday: text("planned_today").notNull().default(""),
    blockers: text("blockers").notNull().default(""),
    channelMessageTs: text("channel_message_ts"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("daily_checkins_user_date_uq").on(t.userId, t.checkinDate)],
);

export type DailyCheckinSelect = typeof dailyCheckins.$inferSelect;
export type DailyCheckinInsert = typeof dailyCheckins.$inferInsert;
