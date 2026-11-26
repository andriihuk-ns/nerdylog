import type { KeyboardEventHandler } from "react";
import { cn } from "@/lib/utils";
import { formatCount, formatDays, formatHours, orDot } from "@/components/lib/format";

const FORMATS = [formatHours, formatDays, formatCount, formatCount] as const;
const SPOKEN = ["hours", "days", "vacation or sick days", "holidays"] as const;

interface Props {
  value: number;
  sub: 0 | 1 | 2 | 3; // index into SUB_COLUMNS
  context: string; // "Jane Doe, Week 2"
  groupStart: boolean;
  total: boolean;
  navProps?: { "data-row": number; "data-col": number; tabIndex: number; onFocus: () => void };
  onKeyDown?: KeyboardEventHandler;
}

/** One numeric cell of the Summary matrix: tabular, right-aligned, zero as a muted dot. */
export function SummaryCell({ value, sub, context, groupStart, total, navProps, onKeyDown }: Props) {
  const vacSick = sub === 2 && value > 0;
  const holiday = sub === 3 && value > 0;
  return (
    <td
      role="gridcell"
      {...navProps}
      onKeyDown={onKeyDown}
      aria-label={`${context}: ${FORMATS[sub](value)} ${SPOKEN[sub]}`}
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
      {orDot(value, FORMATS[sub])}
    </td>
  );
}
