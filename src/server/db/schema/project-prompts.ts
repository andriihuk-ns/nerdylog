import { date, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * Amendment A16: one status prompt per project per office-local date. The cron inserts with
 * ON CONFLICT DO NOTHING and only posts to the channel when a row was inserted.
 */
export const projectPrompts = pgTable(
  "project_prompts",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    promptDate: date("prompt_date", { mode: "string" }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "project_prompts_pk", columns: [t.projectId, t.promptDate] })],
);

export type ProjectPromptSelect = typeof projectPrompts.$inferSelect;
export type ProjectPromptInsert = typeof projectPrompts.$inferInsert;
