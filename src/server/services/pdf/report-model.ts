import type { EntryType, IsoDate, RollupTotals } from "@/contracts";
import type { LedgerRow } from "@/server/db/queries/ledger";
import { computeTotals } from "../time-aggregator";

/** Pure view model for the FR-EXP-02 PDF. Built from ledger rows only (Stream A). */

export interface ReportEntry {
  date: IsoDate;
  project: string;
  entryType: EntryType;
  hours: number;
  tasks: string;
  tickets: string;
}

export interface PtoSummary {
  vacation: number;
  sick: number;
  holiday: number;
}

export interface EmployeeReport {
  userId: string;
  fullName: string;
  dailyNormHours: number;
  entries: ReportEntry[];
  months: Array<{ month: string } & RollupTotals>;
  total: RollupTotals;
  pto: PtoSummary;
}

export interface ReportModel {
  title: string;
  scope: string;
  from: IsoDate;
  to: IsoDate;
  generatedOn: IsoDate;
  employees: EmployeeReport[];
  totalHours: number;
  totalDays: number;
}

export interface ReportOptions {
  from: IsoDate;
  to: IsoDate;
  generatedOn: IsoDate;
  /** Project names when the export was filtered by project (header "client" line). */
  projectNames: readonly string[];
}

function distinctDays(rows: readonly LedgerRow[], type: EntryType): number {
  return new Set(rows.filter((r) => r.entryType === type).map((r) => r.workDate)).size;
}

function employeeReport(rows: readonly LedgerRow[]): EmployeeReport {
  const first = rows[0];
  const byMonth = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const key = r.workDate.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), r]);
  }
  return {
    userId: first.userId,
    fullName: first.fullName,
    dailyNormHours: first.dailyNormHours,
    entries: rows.map((r) => ({
      date: r.workDate,
      project: r.projectName ?? "",
      entryType: r.entryType,
      hours: r.hours,
      tasks: r.taskSummary,
      tickets: r.ticketRefs.join(", "),
    })),
    months: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, monthRows]) => ({ month, ...computeTotals(monthRows, first.dailyNormHours) })),
    total: computeTotals(rows, first.dailyNormHours),
    pto: {
      vacation: distinctDays(rows, "vacation"),
      sick: distinctDays(rows, "sick"),
      holiday: distinctDays(rows, "holiday"),
    },
  };
}

/** Groups rows per employee (sorted by name), entries by date; totals reuse the rollup math. */
export function buildReportModel(rows: readonly LedgerRow[], opts: ReportOptions): ReportModel {
  const byUser = new Map<string, LedgerRow[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const employees = [...byUser.values()]
    .map((userRows) =>
      employeeReport([...userRows].sort((a, b) => a.workDate.localeCompare(b.workDate))),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.userId.localeCompare(b.userId));
  const totalHours = Math.round(employees.reduce((s, e) => s + e.total.hours, 0) * 100) / 100;
  return {
    title: "Time Report",
    scope: opts.projectNames.length > 0 ? opts.projectNames.join(", ") : "All projects",
    from: opts.from,
    to: opts.to,
    generatedOn: opts.generatedOn,
    employees,
    totalHours,
    totalDays: employees.reduce((s, e) => s + e.total.days, 0),
  };
}
