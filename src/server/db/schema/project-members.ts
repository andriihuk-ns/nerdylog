import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";

/**
 * A15: cached members of a project's Slack channel (Tempo users only). Refreshed when a project
 * is saved, on "Sync from Slack" and via "Refresh members". Only members may log work to it.
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
  },
  (t) => [
    primaryKey({ name: "project_members_pk", columns: [t.projectId, t.userId] }),
    index("project_members_user_id_idx").on(t.userId),
  ],
);

export type ProjectMemberSelect = typeof projectMembers.$inferSelect;
export type ProjectMemberInsert = typeof projectMembers.$inferInsert;
