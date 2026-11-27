import type { IsoDate } from "@/contracts";
import type { DbOrTx } from "@/server/db/queries/types";
import {
  deleteOfficeHolidayEntries,
  insertOfficeHolidayEntries,
  syncUserOfficeHolidayEntries,
} from "@/server/db/queries/office-holiday-entries";
import { yearRange } from "./pto-balance";

/**
 * Office holidays show up on people's time automatically: every active member of the office gets a
 * `holiday` row (0 h, source office_holiday) on each holiday date. Rows the user already has on
 * that date are never touched. Only rows with source office_holiday are removed again.
 */
export function fillOfficeHolidayEntries(db: DbOrTx, officeId: string, dates: readonly IsoDate[]): Promise<void> {
  return insertOfficeHolidayEntries(db, officeId, dates);
}

export function clearOfficeHolidayEntries(db: DbOrTx, officeId: string, dates: readonly IsoDate[]): Promise<void> {
  return deleteOfficeHolidayEntries(db, officeId, dates);
}

/** A user moved to another office (or to none): fix their auto-filled holidays for `year`. */
export function syncUserHolidayEntries(db: DbOrTx, userId: string, officeId: string | null, year: number): Promise<void> {
  const { start, end } = yearRange(year);
  return syncUserOfficeHolidayEntries(db, userId, officeId, start, end);
}
