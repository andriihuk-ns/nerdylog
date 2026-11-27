"use client";

import { useTransition } from "react";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { copyHolidaysAction } from "@/app/(dashboard)/admin/holiday-actions";
import { Button } from "@/components/ui/button";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { officeHref } from "./admin-tab";

interface Props {
  officeId: string;
  year: number;
  currentYear: number;
  onToast: (message: string, tone?: "neutral" | "error") => void;
}

/** A15 Holidays header: year switcher, "Copy from {year-1}". */
export function HolidayToolbar({ officeId, year, currentYear, onToast }: Props) {
  const t = useTranslations("admin.holidays");
  const tp = useTranslations("period");
  const [copying, startCopy] = useTransition();
  const href = (y: number) => officeHref(officeId, "holidays", y);

  function copy() {
    startCopy(async () => {
      const res = await copyHolidaysAction({ officeId, fromYear: year - 1, toYear: year });
      if (res.ok) onToast(t("copied", { copied: res.data.copied, skipped: res.data.skipped }));
      else onToast(t("copyFailed", { reason: res.message }), "error");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <PeriodSwitcher
        unit="year"
        label={String(year)}
        prevHref={href(year - 1)}
        nextHref={href(year + 1)}
        todayHref={year === currentYear ? undefined : href(currentYear)}
        todayLabel={tp("thisYear")}
        action={`/admin/offices/${officeId}`}
        pickerValue={String(year)}
        preserveParams={{ tab: "holidays" }}
      />
      <Button variant="outline" className="hit-target" onClick={copy} disabled={copying}>
        <Copy aria-hidden />
        {copying ? t("copying") : t("copyFrom", { year: String(year - 1) })}
      </Button>
    </div>
  );
}
