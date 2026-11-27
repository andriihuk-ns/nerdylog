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
import { PINNED_EDGE_LEFT, PINNED_EDGE_RIGHT, TABLE_EDGE_PADDING } from "@/components/shell/table-styles";
import { SUB_WIDTH_CLASS, subColumnOffset, summaryTableWidth } from "./summary-grid-styles";

interface Props {
  rows: UserMonthRollup[];
  weeks: MonthWeek[];
  today: IsoDate;
  /** A16: Slack avatars by user id (initials when missing). */
  avatars: Record<string, string | null>;
  /** Own row links to /my-time; others to /people/[id]. */
  selfId: string;
}

const STICKY = `sticky left-0 z-10 bg-card text-left ${PINNED_EDGE_RIGHT}`;
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
    <div data-sticky-head className="rounded-lg border bg-card">
      <table
        ref={gridRef}
        role="grid"
        aria-readonly
        aria-label={t("label")}
        className={`table-fixed border-collapse [--name-col:150px] sm:[--name-col:220px] ${TABLE_EDGE_PADDING}`}
        style={{ width: summaryTableWidth(cols) }}
      >
        <colgroup>
          <col className="w-[var(--name-col)]" />
          {Array.from({ length: cols }, (_, i) => (
            <col key={i} className={SUB_WIDTH_CLASS} />
          ))}
        </colgroup>
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
            <th scope="colgroup" colSpan={4} className={cn("sticky right-0 z-30 border-b bg-card px-3 text-left text-xs font-semibold", PINNED_EDGE_LEFT)}>
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
                    "h-8 border-b px-2 text-right font-medium whitespace-nowrap",
                    s === 0 && w !== null && "border-l",
                    w === null && "sticky z-20 bg-card",
                    w === null && s === 0 && PINNED_EDGE_LEFT,
                  )}
                  style={w === null ? { right: subColumnOffset(s) } : undefined}
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
                    stickyOffset={isTotal ? subColumnOffset(s) : undefined}
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
                  stickyOffset={g === weeks.length ? subColumnOffset(s) : undefined}
                />
              ));
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
