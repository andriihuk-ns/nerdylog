import { sql } from "drizzle-orm";
import { boolean, check, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { localeEnum, roleEnum } from "./enums";
import { offices } from "./offices";

/**
 * PRD §5.2 `users`. `auth_user_id` links a Supabase Auth user (auth.users.id) for RLS.
 * A9: `pto_allowance_days` is the yearly vacation allowance; null means "not set".
 * A12: `title` is the Slack profile title; null when Slack has none.
 * A14: `locale` is the UI / bot language; the DB default applies to new users and sync never writes it.
 * A15: `office_id` picks the office whose holidays apply; null = no holidays.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slackUserId: text("slack_user_id").notNull().unique(),
    authUserId: uuid("auth_user_id").unique(),
    fullName: text("full_name").notNull().default(""),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    title: text("title"), // A12: Slack profile title; null = not set
    role: roleEnum("role").notNull().default("member"),
    timezone: text("timezone").notNull().default("Europe/Kyiv"),
    locale: localeEnum("locale").notNull().default("uk"), // A14
    dailyNormHours: numeric("daily_norm_hours", { precision: 3, scale: 1, mode: "number" })
      .notNull()
      .default(8.0),
    ptoAllowanceDays: numeric("pto_allowance_days", { precision: 4, scale: 1, mode: "number" }),
    sickAllowanceDays: numeric("sick_allowance_days", { precision: 4, scale: 1, mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    officeId: uuid("office_id").references(() => offices.id, { onDelete: "set null" }), // A15
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "users_pto_allowance_days_range",
      sql`${t.ptoAllowanceDays} is null or ${t.ptoAllowanceDays} between 0 and 365`,
    ),
    check(
      "users_sick_allowance_days_range",
      sql`${t.sickAllowanceDays} is null or ${t.sickAllowanceDays} between 0 and 365`,
    ),
  ],
);

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
