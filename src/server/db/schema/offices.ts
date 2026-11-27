import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A15: company offices ("UA" Ukraine, "PL" Poland). A user belongs to at most one office
 * (`users.office_id`); company holidays are per office. Codes are uppercase 2–6 letters
 * (enforced in office-service).
 * A16: `timezone` (IANA, validated in office-service) drives project status prompts: UA = Europe/Kyiv,
 * PL = Europe/Warsaw.
 */
export const offices = pgTable("offices", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(), // A16
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OfficeSelect = typeof offices.$inferSelect;
export type OfficeInsert = typeof offices.$inferInsert;
