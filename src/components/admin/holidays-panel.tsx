"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { HolidayView } from "@/contracts";
import { addHolidayAction, removeHolidayAction } from "@/app/(dashboard)/admin/actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { formatDayLong, isIsoDate } from "@/components/lib/dates";

const yearHref = (y: number) => `/admin?tab=holidays&year=${y}`;

/** FR-WEB-06 Holiday Calendar: list by year, add, remove (optimistic). */
export function HolidaysPanel({ holidays, year, currentYear }: { holidays: HolidayView[]; year: number; currentYear: number }) {
  const [list, removeOptimistic] = useOptimistic(holidays, (cur: HolidayView[], id: string) => cur.filter((h) => h.id !== id));
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [, startRemove] = useTransition();
  const { toast, show, dismiss } = useToast();
  const sorted = [...list].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));

  function add(e: FormEvent) {
    e.preventDefault();
    if (!isIsoDate(date)) return setError("Pick a date.");
    if (!name.trim()) return setError("Name is required.");
    setError(null);
    startAdd(async () => {
      const res = await addHolidayAction({ holidayDate: date, name });
      if (!res.ok) return setError(res.message);
      setName("");
      show(`Added ${res.data.name} on ${formatDayLong(res.data.holidayDate)}.`);
    });
  }

  function remove(h: HolidayView) {
    startRemove(async () => {
      removeOptimistic(h.id);
      const res = await removeHolidayAction(h.id);
      if (!res.ok) show(`Couldn't remove ${h.name}. ${res.message}`, { tone: "error", onRetry: () => remove(h) });
    });
  }

  return (
    <section aria-labelledby="holidays-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="holidays-title" className="text-lg font-semibold">
          Holiday calendar
        </h2>
        <PeriodSwitcher
          unit="year"
          label={String(year)}
          prevHref={yearHref(year - 1)}
          nextHref={yearHref(year + 1)}
          todayHref={year === currentYear ? undefined : yearHref(currentYear)}
          todayLabel="This year"
        />
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="holiday-date">Date</Label>
          <Input id="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tabular h-11 w-44" />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="holiday-name">Name</Label>
          <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Independence Day" className="h-11" />
        </div>
        <Button type="submit" disabled={adding} className="hit-target">
          {adding ? "Adding…" : "Add holiday"}
        </Button>
        {error ? (
          <p role="alert" className="w-full text-destructive">
            {error}
          </p>
        ) : null}
      </form>
      {sorted.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">No holidays in {year} yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {sorted.map((h) => (
            <li key={h.id} className="flex items-center gap-4 py-1 pr-2 pl-4">
              <time dateTime={h.holidayDate} className="tabular w-28 font-medium text-holiday">
                {formatDayLong(h.holidayDate)}
              </time>
              <span className="flex-1">{h.name}</span>
              <Button variant="ghost" size="icon" className="hit-target" onClick={() => remove(h)} aria-label={`Remove ${h.name}`}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
