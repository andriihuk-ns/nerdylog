"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { IsoDate, MonthWeek, UserMonthRollup } from "@/contracts";
import { cn } from "@/lib/utils";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import { useFormat } from "@/hooks/use-format";
import { initials } from "@/components/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SummaryCell } from "./summary-cell";
import { bucketValues, SUB_COLUMNS, teamTotals } from "./team-summary";
import { TABLE_EDGE_PADDING } from "@/components/shell/table-styles";

interface Props {
  rows: UserMonthRollup[];
  weeks: MonthWeek[];
  today: IsoDate;
  /** A16: Slack avatars by user id (initials when missing). */
  avatars: Record<string, string | null>;
  /** Own row links to /my-time; others to /people/[id]. */
  selfId: string;
}

const STICKY = "sticky left-0 z-10 w-[150px] min-w-[150px] max-w-[150px] bg-card text-left sticky-edge-right sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px]";
const SUBS = [0, 1, 2, 3] as const;

/** FR-WEB-04 / A2 Summary matrix: month-weeks × (Hours, Days, Vac/Sick, Holidays) + Monthly total. */
export function SummaryGrid({ rows, weeks, today, avatars, selfId }: Props) {
  const cols = (weeks.length + 1) * SUB_COLUMNS.length;
  const { gridRef, cellProps, handleNavKey } = useGridNavigation({ rows: rows.length, cols });
  const totals = teamTotals(rows, weeks.length);
  const t = useTranslations("team.grid");
  const tTeam = useTranslations("team");
  const f = useFormat();

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table ref={gridRef} role="grid" aria-readonly aria-label={t("label")} className={`w-full border-collapse ${TABLE_EDGE_PADDING}`}>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className={cn(STICKY, "border-b px-4 text-xs font-medium text-muted-foreground")}>
              {t("teammate")}
            </th>
            {weeks.map((w) => (
              <th
                key={w.weekIndex}
                scope="colgroup"
                colSpan={4}
                className={cn("border-b border-l px-3 pt-2 text-left font-medium", w.start > today && "text-muted-foreground")}
              >
                <span className="block text-xs">{t("week", { n: w.weekIndex })}</span>
                <span className="tabular block text-xs font-normal text-muted-foreground">
                  {f.shortRange(w.start, w.end)}
                </span>
              </th>
            ))}
            <th scope="colgroup" colSpan={4} className="sticky sticky-edge-left right-0 z-30 w-96 min-w-96 border-b border-l border-l-foreground/20 bg-card px-3 text-left text-xs font-semibold">
              {t("monthlyTotal")}
            </th>
          </tr>
          <tr className="text-xs font-medium text-muted-foreground">
            {[...weeks, null].flatMap((w, g) =>
              SUB_COLUMNS.map((sub, s) => (
                <th
                  key={`${g}-${sub}`}
                  scope="col"
                  className={cn(
                    "h-8 border-b px-3 text-right font-medium whitespace-nowrap",
                    s === 0 && "border-l",
                    s === 0 && w === null && "border-l-foreground/20",
                    w === null && "sticky z-20 w-24 min-w-24 max-w-24 bg-card",
                    w === null && s === 0 && "sticky-edge-left",
                  )}
                  style={w === null ? { right: `${(SUB_COLUMNS.length - s - 1) * 6}rem` } : undefined}
                >
                  {t(`sub.${sub}`)}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row.userId}>
              <th scope="row" className={cn(STICKY, "h-11 border-b px-1 font-medium sm:px-2")}>
                <Link
                  href={row.userId === selfId ? "/my-time" : `/people/${row.userId}?from=team`}
                  title={tTeam("open", { name: row.fullName })}
                  className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-muted/60 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Avatar size="sm">
                    {avatars[row.userId] ? <AvatarImage src={avatars[row.userId] ?? undefined} alt="" /> : null}
                    <AvatarFallback>{initials(row.fullName)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{row.fullName}</span>
                </Link>
              </th>
              {[...row.weeks, row.total].flatMap((bucket, g) => {
                const isTotal = g === row.weeks.length;
                const values = bucketValues(bucket);
                return SUBS.map((s) => (
                  <SummaryCell
                    key={`${g}-${s}`}
                    value={values[s]}
                    sub={s}
                    context={isTotal ? t("contextMonth", { name: row.fullName }) : t("contextWeek", { name: row.fullName, n: g + 1 })}
                    groupStart={s === 0}
                    total={isTotal}
                    stickyOffset={isTotal ? (SUB_COLUMNS.length - s - 1) * 6 : undefined}
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
              {t("teamTotal")}
            </th>
            {[...totals.weeks, totals.total].flatMap((bucket, g) => {
              const values = bucketValues(bucket);
              return SUBS.map((s) => (
                <SummaryCell
                  key={`${g}-${s}`}
                  value={values[s]}
                  sub={s}
                  context={g === weeks.length ? t("contextMonth", { name: t("team") }) : t("contextWeek", { name: t("team"), n: g + 1 })}
                  groupStart={s === 0}
                  total
                  stickyOffset={(SUB_COLUMNS.length - s - 1) * 6}
                />
              ));
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
