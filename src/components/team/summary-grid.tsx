"use client";

import type { IsoDate, MonthWeek, UserMonthRollup } from "@/contracts";
import { cn } from "@/lib/utils";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import { formatShortRange } from "@/components/lib/dates";
import { initials } from "@/components/lib/format";
import { SummaryCell } from "./summary-cell";
import { bucketValues, SUB_COLUMNS, teamTotals } from "./team-summary";

interface Props {
  rows: UserMonthRollup[];
  weeks: MonthWeek[];
  today: IsoDate;
}

const STICKY = "sticky left-0 z-10 w-[220px] min-w-[220px] bg-card text-left";
const SUBS = [0, 1, 2, 3] as const;

/** FR-WEB-04 / A2 Summary matrix: month-weeks × (Hours, Days, Vac/Sick, Holidays) + Monthly total. */
export function SummaryGrid({ rows, weeks, today }: Props) {
  const cols = (weeks.length + 1) * SUB_COLUMNS.length;
  const { gridRef, cellProps, handleNavKey } = useGridNavigation({ rows: rows.length, cols });
  const totals = teamTotals(rows, weeks.length);

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table ref={gridRef} role="grid" aria-readonly aria-label="Team summary by month-week" className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className={cn(STICKY, "border-b px-4 text-xs font-medium text-muted-foreground")}>
              Teammate
            </th>
            {weeks.map((w) => (
              <th
                key={w.weekIndex}
                scope="colgroup"
                colSpan={4}
                className={cn("border-b border-l px-3 pt-2 text-left font-medium", w.start > today && "text-muted-foreground")}
              >
                <span className="block text-xs">Week {w.weekIndex}</span>
                <span className="tabular block text-xs font-normal text-muted-foreground">
                  {formatShortRange(w.start, w.end)}
                </span>
              </th>
            ))}
            <th scope="colgroup" colSpan={4} className="border-b border-l border-l-foreground/20 px-3 text-left text-xs font-semibold">
              Monthly total
            </th>
          </tr>
          <tr className="text-xs font-medium text-muted-foreground">
            {[...weeks, null].flatMap((w, g) =>
              SUB_COLUMNS.map((label, s) => (
                <th
                  key={`${g}-${label}`}
                  scope="col"
                  className={cn(
                    "h-8 border-b px-3 text-right font-medium whitespace-nowrap",
                    s === 0 && "border-l",
                    s === 0 && w === null && "border-l-foreground/20",
                  )}
                >
                  {label}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.userId}>
              <th scope="row" className={cn(STICKY, "h-11 border-b px-4 font-medium")}>
                <span className="flex items-center gap-2">
                  <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    {initials(row.fullName)}
                  </span>
                  <span className="truncate">{row.fullName}</span>
                </span>
              </th>
              {[...row.weeks, row.total].flatMap((bucket, g) => {
                const isTotal = g === row.weeks.length;
                const values = bucketValues(bucket);
                return SUBS.map((s) => (
                  <SummaryCell
                    key={`${g}-${s}`}
                    value={values[s]}
                    sub={s}
                    context={`${row.fullName}, ${isTotal ? "month" : `week ${g + 1}`}`}
                    groupStart={s === 0}
                    total={isTotal}
                    navProps={cellProps(r, g * 4 + s)}
                    onKeyDown={handleNavKey}
                  />
                ));
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={cn(STICKY, "h-11 px-4 font-semibold")}>
              Team total
            </th>
            {[...totals.weeks, totals.total].flatMap((bucket, g) => {
              const values = bucketValues(bucket);
              return SUBS.map((s) => (
                <SummaryCell
                  key={`${g}-${s}`}
                  value={values[s]}
                  sub={s}
                  context={`Team, ${g === weeks.length ? "month" : `week ${g + 1}`}`}
                  groupStart={s === 0}
                  total
                />
              ));
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
