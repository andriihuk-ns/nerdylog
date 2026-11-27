import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { offices } from "./offices";
import { users } from "./users";

/**
 * PRD §5.2 `projects`, reduced by A15 to name + Slack channel (code, cap, billable dropped).
 * A11: `slack_channel_id` = the Slack channel that gets this project's lines; one channel = one project.
 * A15: `created_by` = the admin who created it (null for rows older than A15).
 * A16: the cron posts a status prompt in the channel once per local day at `status_prompt_time`
 * ("HH:MM", 24 h) in the timezone of `status_prompt_office_id` (null → the UA office).
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    slackChannelId: text("slack_channel_id").unique(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    statusPromptTime: text("status_prompt_time").notNull().default("10:00"),
    statusPromptOfficeId: uuid("status_prompt_office_id").references(() => offices.id, { onDelete: "set null" }),
  },
  () => [check("projects_status_prompt_time_check", sql`"status_prompt_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`)],
);

export type ProjectSelect = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
