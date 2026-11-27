import { check, index, numeric, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./projects";
import { users } from "./users";

/**
 * A15: cached Slack channel members (Tempo users only). A26 adds a monthly allocation for each.
 */
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    allocationHoursPerMonth: numeric("allocation_hours_per_month", { precision: 5, scale: 1, mode: "number" })
      .notNull()
      .default(160),
  },
  (t) => [
    primaryKey({ name: "project_members_pk", columns: [t.projectId, t.userId] }),
    index("project_members_user_id_idx").on(t.userId),
    check(
      "project_members_allocation_hours_range",
      sql`${t.allocationHoursPerMonth} between 0.5 and 744 and mod(${t.allocationHoursPerMonth} * 10, 5) = 0`,
    ),
  ],
);

export type ProjectMemberSelect = typeof projectMembers.$inferSelect;
export type ProjectMemberInsert = typeof projectMembers.$inferInsert;
