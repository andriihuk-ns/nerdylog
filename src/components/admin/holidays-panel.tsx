"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { HolidayView, OfficeView } from "@/contracts";
import { removeHolidayAction } from "@/app/(dashboard)/admin/holiday-actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { useFormat } from "@/hooks/use-format";
import { useConfirm } from "@/hooks/use-confirm";
import { HolidayForm } from "./holiday-form";
import { HolidayToolbar } from "./holiday-toolbar";

interface Props {
  office: OfficeView;
  holidays: HolidayView[];
  year: number;
  currentYear: number;
}

/** FR-WEB-06 Holiday Calendar of one office (A15, A37): list by year, add in a modal, remove (optimistic), copy last year. */
export function HolidaysPanel({ office, holidays, year, currentYear }: Props) {
  const [list, removeOptimistic] = useOptimistic(holidays, (cur: HolidayView[], id: string) => cur.filter((h) => h.id !== id));
  const [adding, setAdding] = useState(false);
  const [, startRemove] = useTransition();
  const { toast, show, dismiss } = useToast();
  const t = useTranslations("admin.holidays");
  const f = useFormat();
  const tc = useTranslations("common");
  const { confirm, dialog } = useConfirm();
  const sorted = [...list].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));

  function added(holiday: HolidayView) {
    setAdding(false);
    show(t("added", { name: holiday.name, day: f.dayLong(holiday.holidayDate) }));
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
    <section aria-label={t("title")} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <HolidayToolbar
          officeId={office.id}
          year={year}
          currentYear={currentYear}
          onToast={(message, tone = "neutral") => show(message, { tone })}
        />
        <Button onClick={() => setAdding(true)} className="hit-target w-full sm:w-auto">
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">{t("empty", { year: String(year), office: office.name })}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card" aria-label={t("listLabel", { office: office.name, year: String(year) })}>
          {sorted.map((h) => (
            <li key={h.id} className="flex h-11 items-center gap-4 pr-2 pl-4">
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
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent aria-describedby={undefined} className="overflow-y-auto p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-5 sm:px-6">
            <DialogTitle>{t("new")}</DialogTitle>
          </DialogHeader>
          <HolidayForm office={office} year={year} currentYear={currentYear} onDone={added} onCancel={() => setAdding(false)} />
        </DialogContent>
      </Dialog>
      <Toast toast={toast} onDismiss={dismiss} />
      {dialog}
    </section>
  );
}
