"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";

interface Props {
  label: string; // "Nov 23 – 29, 2026" / "November 2026"
  unit: "week" | "month" | "year";
  prevHref: string;
  nextHref: string;
  todayHref?: string; // omitted when already on the current period
  todayLabel?: string;
  action: string;
  pickerValue: string;
  preserveParams?: Record<string, string>;
}

/** `‹  Nov 23 – 29, 2026  ›  Today`. Keyboard: `[` / `]` / `T` are wired by the page. */
export function PeriodSwitcher({ label, unit, prevHref, nextHref, todayHref, todayLabel, action, pickerValue, preserveParams = {} }: Props) {
  const router = useRouter();
  const t = useTranslations("period");

  function selectPeriod(value: string) {
    const params = new URLSearchParams(preserveParams);
    params.set(unit, value);
    router.push(`${action}?${params}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
      <DatePicker mode={unit} value={pickerValue} label={t("jumpTo", { unit })} onChange={selectPeriod} iconOnly />
    </div>
  );
}
