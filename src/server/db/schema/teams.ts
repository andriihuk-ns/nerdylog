import { boolean, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Amendment A13: a Tempo team mirrors one Slack user group (upsert key `slack_usergroup_id`).
 * `slack_channel_id` is admin-chosen (one channel = one team) and never written by "Sync from Slack".
 * Groups that are disabled in Slack or gone become `is_active = false`; memberships are kept.
 */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  slackUsergroupId: text("slack_usergroup_id").notNull().unique(),
  handle: text("handle").notNull(),
  name: text("name").notNull(),
  slackChannelId: text("slack_channel_id").unique(),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** A13: team membership (many-to-many; a person may be in several teams). */
export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] }), index("team_members_user_id_idx").on(t.userId)],
);

export type TeamSelect = typeof teams.$inferSelect;
export type TeamInsert = typeof teams.$inferInsert;
export type TeamMemberSelect = typeof teamMembers.$inferSelect;
export type TeamMemberInsert = typeof teamMembers.$inferInsert;
