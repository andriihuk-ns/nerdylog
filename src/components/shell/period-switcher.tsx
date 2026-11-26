import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  label: string; // "Nov 23 – 29, 2026" / "November 2026"
  unit: "week" | "month" | "year";
  prevHref: string;
  nextHref: string;
  todayHref?: string; // omitted when already on the current period
  todayLabel?: string;
}

/** `‹  Nov 23 – 29, 2026  ›  Today`. Keyboard: `[` / `]` / `T` are wired by the page. */
export function PeriodSwitcher({ label, unit, prevHref, nextHref, todayHref, todayLabel = "Today" }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" className="hit-target">
        <Link href={prevHref} aria-label={`Previous ${unit}`} aria-keyshortcuts="[">
          <ChevronLeft aria-hidden />
        </Link>
      </Button>
      <p className="tabular min-w-44 text-center text-sm font-medium" aria-live="polite">
        {label}
      </p>
      <Button asChild variant="ghost" size="icon" className="hit-target">
        <Link href={nextHref} aria-label={`Next ${unit}`} aria-keyshortcuts="]">
          <ChevronRight aria-hidden />
        </Link>
      </Button>
      {todayHref ? (
        <Button asChild variant="outline" className="hit-target ml-1">
          <Link href={todayHref} aria-keyshortcuts="T">
            {todayLabel}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
