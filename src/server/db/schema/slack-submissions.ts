import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { slackSubmissionKindEnum } from "./enums";
import { users } from "./users";

/**
 * Amendment A1: idempotency ledger for Slack modal submissions.
 * Insert this row and all its time_entries in ONE transaction; a duplicate view_id
 * (PK violation, SQLSTATE 23505) aborts the whole transaction.
 */
export const slackSubmissions = pgTable("slack_submissions", {
  viewId: text("view_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  kind: slackSubmissionKindEnum("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SlackSubmissionSelect = typeof slackSubmissions.$inferSelect;
export type SlackSubmissionInsert = typeof slackSubmissions.$inferInsert;
