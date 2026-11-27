import { z } from "zod";
import {
  isoDateSchema,
  type Actor,
  type AddHoliday,
  type CopyHolidays,
  type IsoDate,
  type ListHolidays,
  type RemoveHoliday,
} from "@/contracts";
import { getDb } from "@/server/db/client";
import {
  deleteHoliday,
  insertHoliday,
  insertHolidaysSkipExisting,
  listHolidayViews,
  listUserHolidayDates,
  listUserHolidayNames,
} from "@/server/db/queries/catalog";
import { officeExists } from "@/server/db/queries/offices";
import { addDays } from "./calendar";
import { InvalidInputError, NotFoundError } from "./errors";
import { clearOfficeHolidayEntries, fillOfficeHolidayEntries } from "./holiday-entries";
import { isUniqueViolation } from "./pg-errors";
import { yearRange } from "./pto-balance";
import { assertAdmin, assertCanActOnUser } from "./rbac";
import { assertIsoDate, assertRowId, isRowId, parseInput } from "./validation";

/** Postgres name of the (office_id, holiday_date) unique constraint (drizzle/0011). */
export const HOLIDAY_OFFICE_DATE_UNIQUE = "company_holidays_office_date_unique";

function isCalendarDate(d: string): boolean {
  try {
    addDays(d, 0);
    return true;
  } catch {
    return false;
  }
}

const realDate = isoDateSchema.refine(isCalendarDate, "Not a calendar date");

export const holidayInputSchema = z.object({
  officeId: z.uuid("Pick an office"),
  holidayDate: realDate,
  name: z.string().trim().min(1, "Name is required").max(200),
});

const yearSchema = z.number().int().min(2000).max(2100);

/** Contract ListHolidays. Any signed-in user; officeId omitted → every office. RangeError for a bad year. */
export const listHolidays: ListHolidays = async (_actor, year, officeId) => {
  const { start, end } = yearRange(year);
  if (officeId !== undefined && !isRowId(officeId)) return [];
  return listHolidayViews(getDb(), start, end, officeId);
};

/** Named holidays for a user's calendar; members can only read their own office calendar. */
export async function listCalendarHolidayNames(
  actor: Actor,
  userId: string,
  start: IsoDate,
  end: IsoDate,
): Promise<Array<{ date: IsoDate; name: string }>> {
  assertCanActOnUser(actor, userId);
  assertIsoDate(start, "start");
  assertIsoDate(end, "end");
  return listUserHolidayNames(getDb(), userId, start, end);
}

/**
 * Contract AddHoliday (admin). Writes company_holidays (suppresses morning pings and feeds
 * previousBusinessDay) and, in the same transaction, pre-fills a `holiday` row for every active
 * member of the office on that date.
 */
export const addHoliday: AddHoliday = async (actor, input) => {
  assertAdmin(actor);
  const values = parseInput(holidayInputSchema, input);
  const db = getDb();
  if (!(await officeExists(db, values.officeId))) throw InvalidInputError.field("officeId", "Unknown office");
  try {
    return await db.transaction(async (tx) => {
      const row = await insertHoliday(tx, values);
      await fillOfficeHolidayEntries(tx, values.officeId, [values.holidayDate]);
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error, HOLIDAY_OFFICE_DATE_UNIQUE)) {
      throw InvalidInputError.field("holidayDate", "This office already has a holiday on this date");
    }
    throw error;
  }
};

/** Contract RemoveHoliday (admin). Also removes the holiday rows it pre-filled for that office. */
export const removeHoliday: RemoveHoliday = async (actor, id) => {
  assertAdmin(actor);
  assertRowId(id, "Holiday");
  const db = getDb();
  await db.transaction(async (tx) => {
    const removed = await deleteHoliday(tx, id);
    if (!removed) throw new NotFoundError("Holiday not found");
    await clearOfficeHolidayEntries(tx, removed.officeId, [removed.holidayDate]);
  });
};

/**
 * Pure: `fromYear` holidays moved to `toYear` with the same month/day. Dates that do not exist
 * in `toYear` (Feb 29) are dropped and counted as skipped.
 */
export function shiftHolidaysToYear<T extends { holidayDate: IsoDate }>(
  rows: readonly T[],
  toYear: number,
): { shifted: T[]; invalid: number } {
  const shifted: T[] = [];
  let invalid = 0;
  for (const row of rows) {
    const date = `${String(toYear).padStart(4, "0")}${row.holidayDate.slice(4)}`;
    if (isCalendarDate(date)) shifted.push({ ...row, holidayDate: date });
    else invalid++;
  }
  return { shifted, invalid };
}

/**
 * Contract CopyHolidays (admin). Copies an office's holidays from `fromYear` to `toYear` with the
 * same month/day; dates the office already has in `toYear` are skipped (and Feb 29 into a non-leap
 * year). Moving feasts (Easter) must then be adjusted by hand.
 */
export const copyHolidays: CopyHolidays = async (actor, officeId, fromYear, toYear) => {
  assertAdmin(actor);
  const years = parseInput(z.object({ fromYear: yearSchema, toYear: yearSchema }), { fromYear, toYear });
  if (years.fromYear === years.toYear) throw InvalidInputError.field("toYear", "Pick a different year");
  if (!isRowId(officeId)) throw InvalidInputError.field("officeId", "Unknown office");
  const db = getDb();
  if (!(await officeExists(db, officeId))) throw InvalidInputError.field("officeId", "Unknown office");
  const { start, end } = yearRange(years.fromYear);
  const source = await listHolidayViews(db, start, end, officeId);
  const { shifted } = shiftHolidaysToYear(source, years.toYear);
  return db.transaction(async (tx) => {
    const copied = await insertHolidaysSkipExisting(
      tx,
      shifted.map((h) => ({ officeId, holidayDate: h.holidayDate, name: h.name })),
    );
    await fillOfficeHolidayEntries(
      tx,
      officeId,
      shifted.map((h) => h.holidayDate),
    );
    return { copied, skipped: source.length - copied };
  });
};

/**
 * A15 system read (no actor; Slack layer and services): holiday dates of the user's office in
 * [from, to]. A user without an office (or an unknown id) gets []. RangeError for bad dates.
 */
export async function listHolidayDatesForUser(userId: string, from: IsoDate, to: IsoDate): Promise<IsoDate[]> {
  assertIsoDate(from, "from");
  assertIsoDate(to, "to");
  if (!isRowId(userId) || from > to) return [];
  return listUserHolidayDates(getDb(), userId, from, to);
}
