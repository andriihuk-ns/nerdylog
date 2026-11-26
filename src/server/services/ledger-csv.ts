import type { UserMonthRollup } from "@/contracts";
import type { LedgerRow } from "@/server/db/queries/ledger";
import { isoWeek, monthWeeks } from "./calendar";
import { formatNumber, safeText, type CsvCell } from "./csv";
import { DEFAULT_DAILY_NORM_HOURS } from "./time-aggregator";

export type { LedgerRow };

/** FR-EXP-01 ledger header, exact order. */
export const LEDGER_HEADER = [
  "Date",
  "ISO_Week",
  "Employee",
  "Project",
  "Entry_Type",
  "Hours",
  "Day_Equiv",
  "Tasks",
  "Ticket_IDs",
  "Source",
] as const;

export function dayEquivalent(hours: number, dailyNormHours: number): number {
  const norm = Number.isFinite(dailyNormHours) && dailyNormHours > 0 ? dailyNormHours : DEFAULT_DAILY_NORM_HOURS;
  return hours / norm;
}

/** Pure: header + one line per entry, in the order given. Day_Equiv = hours / user norm. */
export function buildLedgerRows(rows: readonly LedgerRow[]): CsvCell[][] {
  return [
    [...LEDGER_HEADER],
    ...rows.map((r) => [
      r.workDate,
      isoWeek(r.workDate),
      safeText(r.fullName),
      safeText(r.projectName ?? ""),
      r.entryType,
      formatNumber(r.hours, 2),
      formatNumber(dayEquivalent(r.hours, r.dailyNormHours), 4),
      safeText(r.taskSummary),
      r.ticketRefs.join("; "),
      r.source,
    ]),
  ];
}

const METRICS = ["Hours", "Days", "Vac/Sick", "Holidays"] as const;

/**
 * Pure Monthly Summary Pivot (FR-EXP-01 mode 2), mirroring the /team matrix: one row per
 * user; per month-week (A2) Hours, Days, Vac/Sick, Holidays; then the monthly total.
 */
export function buildSummaryRows(month: string, rollups: readonly UserMonthRollup[]): CsvCell[][] {
  const weeks = monthWeeks(month); // header even when no users
  const header: CsvCell[] = ["Employee", "Daily_Norm_Hours"];
  for (const w of weeks) {
    const label = `Week ${w.weekIndex} (${w.start.slice(5)}..${w.end.slice(5)})`;
    for (const m of METRICS) header.push(`${label} ${m}`);
  }
  for (const m of METRICS) header.push(`${month} Total ${m}`);

  const lines = rollups.map((r) => {
    const cells: CsvCell[] = [safeText(r.fullName), formatNumber(r.dailyNormHours, 1)];
    for (const w of r.weeks) cells.push(...totalsCells(w));
    cells.push(...totalsCells(r.total));
    return cells;
  });
  return [header, ...lines];
}

function totalsCells(t: { hours: number; days: number; vacSick: number; holidays: number }): CsvCell[] {
  return [formatNumber(t.hours, 2), formatNumber(t.days, 2), t.vacSick, t.holidays];
}
