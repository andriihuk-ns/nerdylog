import { date, pgTable, text, uuid } from "drizzle-orm/pg-core";

/** PRD §5.2 `company_holidays`. One row per date. */
export const companyHolidays = pgTable("company_holidays", {
  id: uuid("id").primaryKey().defaultRandom(),
  holidayDate: date("holiday_date", { mode: "string" }).notNull().unique(),
  name: text("name").notNull(),
});

export type CompanyHolidaySelect = typeof companyHolidays.$inferSelect;
export type CompanyHolidayInsert = typeof companyHolidays.$inferInsert;
