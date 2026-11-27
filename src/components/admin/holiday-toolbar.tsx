"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OfficeView } from "@/contracts";
import { copyHolidaysAction } from "@/app/(dashboard)/admin/holiday-actions";
import { Button } from "@/components/ui/button";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { SegmentedControl } from "@/components/shell/segmented-control";
import { adminHref } from "./admin-tab";

interface Props {
  offices: OfficeView[];
  officeId: string;
  year: number;
  currentYear: number;
  onToast: (message: string, tone?: "neutral" | "error") => void;
}

/** A15 Holidays header: office segmented filter (UA | PL | …), year switcher, "Copy from {year-1}". */
export function HolidayToolbar({ offices, officeId, year, currentYear, onToast }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.holidays");
  const tp = useTranslations("period");
  const [copying, startCopy] = useTransition();
  const href = (y: number, office = officeId) => adminHref("holidays", y, office);

  function copy() {
    startCopy(async () => {
      const res = await copyHolidaysAction({ officeId, fromYear: year - 1, toYear: year });
      if (res.ok) onToast(t("copied", { copied: res.data.copied, skipped: res.data.skipped }));
      else onToast(t("copyFailed", { reason: res.message }), "error");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl
        label={t("officeFilter")}
        value={officeId}
        onChange={(id) => router.replace(href(year, id), { scroll: false })}
        className="h-9"
        options={offices.map((o) => ({ value: o.id, content: o.code, title: o.name, ariaLabel: `${o.code} · ${o.name}` }))}
      />
      <PeriodSwitcher
        unit="year"
        label={String(year)}
        prevHref={href(year - 1)}
        nextHref={href(year + 1)}
        todayHref={year === currentYear ? undefined : href(currentYear)}
        todayLabel={tp("thisYear")}
      />
      <Button variant="outline" className="hit-target" onClick={copy} disabled={copying}>
        <Copy aria-hidden />
        {copying ? t("copying") : t("copyFrom", { year: String(year - 1) })}
      </Button>
    </div>
  );
}
