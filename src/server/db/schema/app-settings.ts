import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Amendment A11: admin-editable key/value settings (no redeploy needed).
 * Known keys: `standup_channel_id` (general channel for full standup cards).
 * Absent row = setting not set.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AppSettingSelect = typeof appSettings.$inferSelect;
export type AppSettingInsert = typeof appSettings.$inferInsert;
