"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { HolidayView, OfficeView } from "@/contracts";
import { addHolidayAction } from "@/app/(dashboard)/admin/holiday-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { isIsoDate } from "@/components/lib/dates";

interface Props {
  office: OfficeView;
  year: number;
  currentYear: number;
  onDone: (holiday: HolidayView) => void;
  onCancel: () => void;
}

/** New holiday for one office (A15); another year than the current one pre-selects its 1 January. */
export function HolidayForm({ office, year, currentYear, onDone, onCancel }: Props) {
  const t = useTranslations("admin.holidays");
  const tc = useTranslations("common");
  const [date, setDate] = useState(year === currentYear ? "" : `${year}-01-01`);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!isIsoDate(date)) return setError(t("pickDate"));
    if (!name.trim()) return setError(t("nameRequired"));
    setError(null);
    startTransition(async () => {
      const res = await addHolidayAction({ officeId: office.id, holidayDate: date, name });
      if (res.ok) onDone(res.data);
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} aria-label={t("addFor", { office: office.name })} className="flex flex-col gap-4 p-4 sm:px-6 sm:pb-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="holiday-name">{t("name")}</Label>
        <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} placeholder={t("placeholder")} className="h-11" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="holiday-date">{t("date")}</Label>
        <DatePicker id="holiday-date" value={date} label={t("date")} placeholder={t("pickDate")} onChange={setDate} className="w-full" />
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="hit-target" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" className="hit-target" disabled={pending}>
          {pending ? t("adding") : t("create")}
        </Button>
      </div>
    </form>
  );
}
