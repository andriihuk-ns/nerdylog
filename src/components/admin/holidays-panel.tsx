"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { HolidayView, OfficeView } from "@/contracts";
import { addHolidayAction, removeHolidayAction } from "@/app/(dashboard)/admin/holiday-actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { isIsoDate } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { useConfirm } from "@/hooks/use-confirm";
import { HolidayToolbar } from "./holiday-toolbar";

interface Props {
  holidays: HolidayView[];
  offices: OfficeView[];
  officeId: string | null; // null → no offices yet
  year: number;
  currentYear: number;
}

/** FR-WEB-06 Holiday Calendar per office (A15): list by office + year, add, remove (optimistic), copy last year. */
export function HolidaysPanel({ holidays, offices, officeId, year, currentYear }: Props) {
  const [list, removeOptimistic] = useOptimistic(holidays, (cur: HolidayView[], id: string) => cur.filter((h) => h.id !== id));
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [, startRemove] = useTransition();
  const { toast, show, dismiss } = useToast();
  const t = useTranslations("admin.holidays");
  const f = useFormat();
  const tc = useTranslations("common");
  const { confirm, dialog } = useConfirm();
  const office = offices.find((o) => o.id === officeId);
  const sorted = [...list].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));

  if (!officeId || !office) {
    return <p className="rounded-lg border bg-card p-6 text-muted-foreground">{t("noOffices")}</p>;
  }
  const selectedOfficeId = officeId;

  function add(e: FormEvent) {
    e.preventDefault();
    if (!isIsoDate(date)) return setError(t("pickDate"));
    if (!name.trim()) return setError(t("nameRequired"));
    setError(null);
    startAdd(async () => {
      const res = await addHolidayAction({ officeId: selectedOfficeId, holidayDate: date, name });
      if (!res.ok) return setError(res.message);
      setName("");
      show(t("added", { name: res.data.name, day: f.dayLong(res.data.holidayDate) }));
    });
  }

  async function confirmRemove(h: HolidayView) {
    const ok = await confirm({ title: t("confirmRemove", { name: h.name }), description: tc("cantUndo"), confirmLabel: tc("delete") });
    if (ok) remove(h);
  }

  function remove(h: HolidayView) {
    startRemove(async () => {
      removeOptimistic(h.id);
      const res = await removeHolidayAction(h.id);
      if (!res.ok) show(t("removeFailed", { name: h.name, reason: res.message }), { tone: "error", onRetry: () => remove(h) });
    });
  }

  return (
    <section aria-labelledby="holidays-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="holidays-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <HolidayToolbar
          offices={offices}
          officeId={officeId}
          year={year}
          currentYear={currentYear}
          onToast={(message, tone = "neutral") => show(message, { tone })}
        />
      </div>
      <form onSubmit={add} aria-label={t("addFor", { office: office.name })} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <Label htmlFor="holiday-date">{t("date")}</Label>
          <Input id="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tabular h-11 w-full sm:w-44" />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="holiday-name">{t("name")}</Label>
          <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t("placeholder")} className="h-11" />
        </div>
        <Button type="submit" disabled={adding} className="hit-target w-full sm:w-auto">
          {adding ? t("adding") : t("addTo", { code: office.code })}
        </Button>
        {error ? (
          <p role="alert" className="w-full text-destructive">
            {error}
          </p>
        ) : null}
      </form>
      {sorted.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">{t("empty", { year: String(year), office: office.name })}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card" aria-label={t("listLabel", { office: office.name, year: String(year) })}>
          {sorted.map((h) => (
            <li key={h.id} className="flex items-center gap-4 py-1 pr-2 pl-4">
              <time dateTime={h.holidayDate} className="tabular w-28 font-medium text-holiday">
                {f.dayLong(h.holidayDate)}
              </time>
              <span className="flex-1">{h.name}</span>
              <Button variant="ghost" size="icon" className="hit-target" onClick={() => void confirmRemove(h)} aria-label={t("remove", { name: h.name })}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
      {dialog}
    </section>
  );
}
