import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * PRD §5.2 `projects`, reduced by A15 to name + Slack channel (code, cap, billable dropped).
 * A11: `slack_channel_id` = the Slack channel that gets this project's lines; one channel = one project.
 * A15: `created_by` = the admin who created it (null for rows older than A15).
 */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  slackChannelId: text("slack_channel_id").unique(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
});

export type ProjectSelect = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
