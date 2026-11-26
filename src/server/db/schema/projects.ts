import { boolean, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";

/**
 * PRD §5.2 `projects`. `monthly_hour_cap` null = no client cap.
 * A11: `slack_channel_id` = the Slack channel that gets this project's lines; one channel = one project.
 */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").unique(),
  monthlyHourCap: numeric("monthly_hour_cap", { precision: 5, scale: 1, mode: "number" }),
  isBillable: boolean("is_billable").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  slackChannelId: text("slack_channel_id").unique(),
});

export type ProjectSelect = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
