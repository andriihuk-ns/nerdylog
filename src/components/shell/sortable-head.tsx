import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortDirection } from "@/components/lib/sort";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  direction: SortDirection | null;
  onSort: () => void;
  className?: string;
  style?: CSSProperties;
  rowSpan?: number;
  align?: "left" | "center" | "right";
  /** Narrow columns: no space is kept for the icon until the column is sorted. */
  compact?: boolean;
}

/** A column head whose label cycles the sort; the state is announced through `aria-sort`. */
export function SortableHead({ children, direction, onSort, className, style, rowSpan, align = "left", compact = false }: Props) {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      rowSpan={rowSpan}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}
      className={className}
      style={style}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "group/sort inline-flex h-full min-h-8 w-full items-center gap-1 rounded-sm whitespace-nowrap hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
          align === "right" && "flex-row-reverse",
          align === "center" && "justify-center",
          direction && "text-foreground",
        )}
      >
        {children}
        {compact && !direction ? null : (
          <Icon aria-hidden className={cn("size-3.5 shrink-0", !direction && "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60")} />
        )}
      </button>
    </th>
  );
}
