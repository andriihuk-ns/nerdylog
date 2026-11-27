import { sql } from "drizzle-orm";
import type { IsoDate } from "@/contracts";
import type { DbOrTx } from "./types";

/** Postgres array literal of dates, e.g. `array['2026-01-01','2026-05-01']::date[]`. */
function dateArray(dates: readonly IsoDate[]) {
  return sql`array[${sql.join(
    dates.map((d) => sql`${d}`),
    sql`, `,
  )}]::date[]`;
}

/**
 * Pre-fill `holiday` rows (0 h, no project, source office_holiday) for every active member of
 * an office on the given dates. A user who already has any entry that day keeps it.
 */
export async function insertOfficeHolidayEntries(db: DbOrTx, officeId: string, dates: readonly IsoDate[]): Promise<void> {
  if (dates.length === 0) return;
  await db.execute(sql`
    insert into time_entries (user_id, work_date, hours, entry_type, source)
    select u.id, d.work_date, 0, 'holiday', 'office_holiday'
    from users u
    cross join unnest(${dateArray(dates)}) as d(work_date)
    where u.office_id = ${officeId}::uuid
      and u.is_active
      and not exists (
        select 1 from time_entries t where t.user_id = u.id and t.work_date = d.work_date
      )
  `);
}

/** Remove the auto-filled holiday rows of an office on the given dates (manual entries stay). */
export async function deleteOfficeHolidayEntries(db: DbOrTx, officeId: string, dates: readonly IsoDate[]): Promise<void> {
  if (dates.length === 0) return;
  await db.execute(sql`
    delete from time_entries t
    using users u
    where t.user_id = u.id
      and u.office_id = ${officeId}::uuid
      and t.entry_type = 'holiday'
      and t.source = 'office_holiday'
      and t.work_date = any(${dateArray(dates)})
  `);
}

/**
 * Bring one user's auto-filled holiday rows in [start, end] in line with their office
 * (office null → none). Drops rows whose date is no longer a holiday of the office, then adds the
 * office's holidays the user has no entry for.
 */
export async function syncUserOfficeHolidayEntries(
  db: DbOrTx,
  userId: string,
  officeId: string | null,
  start: IsoDate,
  end: IsoDate,
): Promise<void> {
  await db.execute(sql`
    delete from time_entries t
    where t.user_id = ${userId}::uuid
      and t.entry_type = 'holiday'
      and t.source = 'office_holiday'
      and t.work_date between ${start}::date and ${end}::date
      and not exists (
        select 1 from company_holidays h
        where h.office_id = ${officeId}::uuid and h.holiday_date = t.work_date
      )
  `);
  if (!officeId) return;
  await db.execute(sql`
    insert into time_entries (user_id, work_date, hours, entry_type, source)
    select ${userId}::uuid, h.holiday_date, 0, 'holiday', 'office_holiday'
    from company_holidays h
    where h.office_id = ${officeId}::uuid
      and h.holiday_date between ${start}::date and ${end}::date
      and not exists (
        select 1 from time_entries t where t.user_id = ${userId}::uuid and t.work_date = h.holiday_date
      )
  `);
}
