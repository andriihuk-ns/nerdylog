import type { KeyboardEventHandler } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { orDot } from "@/components/lib/format";
import { useFormat } from "@/hooks/use-format";
import { SUB_COLUMNS } from "./team-summary";

interface Props {
  value: number;
  sub: 0 | 1 | 2 | 3; // index into SUB_COLUMNS
  context: string; // "Jane Doe, week 2"
  groupStart: boolean;
  total: boolean;
  navProps?: { "data-row": number; "data-col": number; tabIndex: number; onFocus: () => void };
  onKeyDown?: KeyboardEventHandler;
}

/** One numeric cell of the Summary matrix: tabular, right-aligned, zero as a muted dot. */
export function SummaryCell({ value, sub, context, groupStart, total, navProps, onKeyDown }: Props) {
  const t = useTranslations("team.grid.spoken");
  const f = useFormat();
  const format = [f.hours, f.days, f.count, f.count][sub];
  const vacSick = sub === 2 && value > 0;
  const holiday = sub === 3 && value > 0;
  return (
    <td
      role="gridcell"
      {...navProps}
      onKeyDown={onKeyDown}
      aria-label={t(SUB_COLUMNS[sub], { context, value: format(value) })}
      className={cn(
        "tabular h-11 min-w-16 border-b px-3 text-right outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        groupStart && "border-l",
        total && groupStart && "border-l-foreground/20",
        total && "font-semibold",
        value === 0 && "text-muted-foreground",
        vacSick && "bg-pto-subtle text-pto",
        holiday && "text-holiday",
      )}
    >
      {orDot(value, format)}
    </td>
  );
}
