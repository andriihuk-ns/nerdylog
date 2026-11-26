import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entrySourceEnum, entryTypeEnum } from "./enums";
import { projects } from "./projects";
import { users } from "./users";

/**
 * PRD §5.2 `time_entries` (Stream A, the only source of tracked hours).
 * A1: `slack_view_id` is NOT unique; dedup lives in `slack_submissions`.
 * A6: indexes on (user_id, work_date) and (project_id, work_date).
 */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "restrict" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    hours: numeric("hours", { precision: 4, scale: 2, mode: "number" }).notNull(),
    entryType: entryTypeEnum("entry_type").notNull(),
    taskSummary: text("task_summary").notNull().default(""),
    ticketRefs: text("ticket_refs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    source: entrySourceEnum("source").notNull(),
    slackViewId: text("slack_view_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("time_entries_user_date_idx").on(t.userId, t.workDate),
    index("time_entries_project_date_idx").on(t.projectId, t.workDate),
    index("time_entries_slack_view_id_idx").on(t.slackViewId),
    check("time_entries_hours_range", sql`${t.hours} >= 0 and ${t.hours} <= 24`),
    check(
      "time_entries_work_has_project",
      sql`${t.entryType} <> 'work' or ${t.projectId} is not null`,
    ),
    check("time_entries_pto_zero_hours", sql`${t.entryType} = 'work' or ${t.hours} = 0`),
  ],
);

export type TimeEntrySelect = typeof timeEntries.$inferSelect;
export type TimeEntryInsert = typeof timeEntries.$inferInsert;
