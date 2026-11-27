import { date, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { offices } from "./offices";

/** PRD §5.2 `company_holidays`; A15: per office, one row per office and date. */
export const companyHolidays = pgTable(
  "company_holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "restrict" }),
    holidayDate: date("holiday_date", { mode: "string" }).notNull(),
    name: text("name").notNull(),
  },
  (t) => [unique("company_holidays_office_date_unique").on(t.officeId, t.holidayDate)],
);

export type CompanyHolidaySelect = typeof companyHolidays.$inferSelect;
export type CompanyHolidayInsert = typeof companyHolidays.$inferInsert;
