import { z } from "zod";
import { isoDateSchema, type AddHoliday, type ListHolidays, type RemoveHoliday } from "@/contracts";
import { getDb } from "@/server/db/client";
import { deleteHoliday, insertHoliday, listHolidayViews } from "@/server/db/queries/catalog";
import { addDays } from "./calendar";
import { InvalidInputError, NotFoundError } from "./errors";
import { isUniqueViolation } from "./pg-errors";
import { yearRange } from "./pto-balance";
import { assertAdmin } from "./rbac";
import { assertRowId, parseInput } from "./validation";

/** Postgres name of the company_holidays.holiday_date unique constraint. */
export const HOLIDAY_DATE_UNIQUE = "company_holidays_holiday_date_unique";

const realDate = isoDateSchema.refine((d) => {
  try {
    addDays(d, 0);
    return true;
  } catch {
    return false;
  }
}, "Not a calendar date");

export const holidayInputSchema = z.object({
  holidayDate: realDate,
  name: z.string().trim().min(1, "Name is required").max(200),
});

/** Contract ListHolidays. Any signed-in user. RangeError for a bad year. */
export const listHolidays: ListHolidays = async (_actor, year) => {
  const { start, end } = yearRange(year);
  return listHolidayViews(getDb(), start, end);
};

/**
 * Contract AddHoliday (admin). Only writes company_holidays: it suppresses morning pings
 * and feeds previousBusinessDay. It does NOT pre-fill `holiday` time entries (follow-up).
 */
export const addHoliday: AddHoliday = async (actor, input) => {
  assertAdmin(actor);
  const { holidayDate, name } = parseInput(holidayInputSchema, input);
  try {
    return await insertHoliday(getDb(), holidayDate, name);
  } catch (error) {
    if (isUniqueViolation(error, HOLIDAY_DATE_UNIQUE)) {
      throw InvalidInputError.field("holidayDate", "A holiday already exists on this date");
    }
    throw error;
  }
};

/** Contract RemoveHoliday (admin). */
export const removeHoliday: RemoveHoliday = async (actor, id) => {
  assertAdmin(actor);
  assertRowId(id, "Holiday");
  if (!(await deleteHoliday(getDb(), id))) throw new NotFoundError("Holiday not found");
};
