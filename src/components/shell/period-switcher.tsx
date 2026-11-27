import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { IsoDate } from "@/contracts";

interface Props {
  label: string; // "Nov 23 – 29, 2026" / "November 2026"
  unit: "week" | "month" | "year";
  prevHref: string;
  nextHref: string;
  todayHref?: string; // omitted when already on the current period
  todayLabel?: string;
  action: string;
  pickerValue: IsoDate | string;
  preserveParams?: Record<string, string>;
}

/** `‹  Nov 23 – 29, 2026  ›  Today`. Keyboard: `[` / `]` / `T` are wired by the page. */
export function PeriodSwitcher({ label, unit, prevHref, nextHref, todayHref, todayLabel, action, pickerValue, preserveParams = {} }: Props) {
  const t = useTranslations("period");
  const inputType = unit === "week" ? "date" : unit === "month" ? "month" : "number";
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button asChild variant="ghost" size="icon" className="hit-target">
        <Link href={prevHref} scroll={false} aria-label={t("previous", { unit })} aria-keyshortcuts="[">
          <ChevronLeft aria-hidden />
        </Link>
      </Button>
      <p className="tabular min-w-0 text-center text-sm font-medium whitespace-nowrap sm:min-w-44" aria-live="polite">
        {label}
      </p>
      <Button asChild variant="ghost" size="icon" className="hit-target">
        <Link href={nextHref} scroll={false} aria-label={t("next", { unit })} aria-keyshortcuts="]">
          <ChevronRight aria-hidden />
        </Link>
      </Button>
      {todayHref ? (
        <Button asChild variant="outline" className="hit-target ml-1">
          <Link href={todayHref} scroll={false} aria-keyshortcuts="T">
            {todayLabel ?? t("today")}
          </Link>
        </Button>
      ) : null}
      <form action={action} method="get" className="ml-1 flex items-center gap-1.5">
        {Object.entries(preserveParams).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input
          type={inputType}
          name={unit}
          defaultValue={pickerValue}
          required
          step={unit === "year" ? 1 : undefined}
          min={unit === "year" ? "1900" : undefined}
          max={unit === "year" ? "2200" : undefined}
          aria-label={t("jumpTo", { unit })}
          className="hit-target h-10 w-36 rounded-md border border-input bg-card px-2 text-sm tabular text-foreground"
        />
        <Button type="submit" variant="outline" className="hit-target">
          {t("go")}
        </Button>
      </form>
    </div>
  );
}
