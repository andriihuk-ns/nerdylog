"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { EntryType, IsoDate, TimeEntryView } from "@/contracts";
import { saveCellAction, setDayStatusAction } from "@/app/(dashboard)/my-time/actions";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useToast } from "@/hooks/use-toast";
import { Toast } from "@/components/ui/toast";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { addDays, mondayOf, weekDays } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { cellKey, WeekGrid } from "./week-grid";
import { applyOptimisticEntry, buildWeekMatrix, type ProjectOption, type ProjectRef } from "./week-matrix";

interface Props {
  weekStart: IsoDate;
  today: IsoDate;
  entries: TimeEntryView[];
  /** A15: all active projects; non-members carry a disabledReason. */
  projects: ProjectOption[];
  /** A15 people page: edit this person's week (admin); omitted → the signed-in user. */
  userId?: string;
  /** Page path for week links (`/my-time` or `/admin/people/{id}`). */
  basePath?: string;
  title?: string;
}

/** Weekly matrix client island (My Time and the people page): optimistic state, toasts, week shortcuts. */
export function WeekView({ weekStart, today, entries, projects, userId, basePath = "/my-time", title }: Props) {
  const weekHref = (d: IsoDate) => `${basePath}?week=${d}`;
  const router = useRouter();
  const t = useTranslations("myTime");
  const tc = useTranslations("common");
  const f = useFormat();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const [optimisticEntries, applyOptimistic] = useOptimistic(entries, applyOptimisticEntry);
  const [pendingKeys, addPending] = useOptimistic<string[], string>([], (s, k) => [...s, k]);
  const [, startTransition] = useTransition();
  const [pinned, setPinned] = useState<ProjectRef[]>([]);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const { toast, show, dismiss } = useToast();

  const matrix = useMemo(() => buildWeekMatrix(days, optimisticEntries, pinned), [days, optimisticEntries, pinned]);
  const shown = new Set(matrix.rows.map((r) => r.projectId));
  const addable = projects.filter((p) => !shown.has(p.id));

  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const thisWeek = mondayOf(today);
  useHotkeys({
    "[": () => router.push(weekHref(prev)),
    "]": () => router.push(weekHref(next)),
    t: () => router.push(weekHref(thisWeek)),
  });

  const pin = (project: ProjectRef) =>
    setPinned((cur) => (cur.some((p) => p.id === project.id) ? cur : [...cur, project]));

  function saveCell(project: ProjectRef, date: IsoDate, hours: number, note?: string) {
    const key = cellKey(project.id, date);
    pin(project);
    setFailedKey(null);
    startTransition(async () => {
      applyOptimistic({ type: "cell", date, project, hours, note });
      addPending(key);
      const res = await saveCellAction({ date, projectId: project.id, hours, note, userId });
      if (!res.ok) {
        setFailedKey(key);
        show(t("saveFailed", { hours: f.hours(hours), day: f.dayLong(date), reason: res.message }), {
          tone: "error",
          onRetry: () => saveCell(project, date, hours, note),
        });
      }
    });
  }

  function setStatus(date: IsoDate, status: EntryType) {
    const i = days.indexOf(date);
    const logged = matrix.dayTotals[i] ?? 0;
    if (status === matrix.dayStatus[i]) return;
    if (status !== "work" && logged > 0 && !window.confirm(t("confirmClear", { hours: f.hours(logged), day: f.dayLong(date) }))) {
      return;
    }
    startTransition(async () => {
      applyOptimistic({ type: "status", date, status });
      const res = await setDayStatusAction({ date, status, userId });
      if (!res.ok) {
        show(t("statusFailed", { day: f.dayLong(date), reason: res.message }), {
          tone: "error",
          onRetry: () => setStatus(date, status),
        });
      }
    });
  }

  return (
    <section aria-labelledby="my-time-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          {userId ? (
            <h2 id="my-time-title" className="text-lg font-semibold">
              {title ?? t("title")}
            </h2>
          ) : (
            <h1 id="my-time-title" className="text-2xl font-semibold tracking-[-0.01em]">
              {title ?? t("title")}
            </h1>
          )}
          <PeriodSwitcher
            unit="week"
            label={f.weekRange(days[0], days[6])}
            prevHref={weekHref(prev)}
            nextHref={weekHref(next)}
            todayHref={weekStart === thisWeek ? undefined : weekHref(thisWeek)}
          />
        </div>
        <p className="text-right">
          <span className="block text-xs font-medium text-muted-foreground">{t("weeklyTotal")}</span>
          <data value={matrix.weekTotal} className="tabular text-2xl font-semibold">
            {tc("hours", { value: f.hours(matrix.weekTotal) })}
          </data>
        </p>
      </div>
      <WeekGrid
        matrix={matrix}
        addable={addable}
        pendingKeys={pendingKeys}
        failedKey={failedKey}
        onSaveCell={saveCell}
        onSetStatus={setStatus}
        onAddProject={pin}
      />
      {matrix.rows.length === 0 ? (
        <p className="text-muted-foreground">
          {t("empty")}
        </p>
      ) : null}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
