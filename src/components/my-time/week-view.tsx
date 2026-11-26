"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EntryType, IsoDate, TimeEntryView } from "@/contracts";
import { saveCellAction, setDayStatusAction } from "@/app/(dashboard)/my-time/actions";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useToast } from "@/hooks/use-toast";
import { Toast } from "@/components/ui/toast";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { addDays, formatDayLong, formatWeekRange, mondayOf, weekDays } from "@/components/lib/dates";
import { formatHours } from "@/components/lib/format";
import { cellKey, WeekGrid } from "./week-grid";
import { applyOptimisticEntry, buildWeekMatrix, type ProjectRef } from "./week-matrix";

interface Props {
  weekStart: IsoDate;
  today: IsoDate;
  entries: TimeEntryView[];
  activeProjects: ProjectRef[];
}

const weekHref = (d: IsoDate) => `/my-time?week=${d}`;

/** /my-time client island: optimistic state, toasts, week shortcuts. Data comes from the server page. */
export function WeekView({ weekStart, today, entries, activeProjects }: Props) {
  const router = useRouter();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const [optimisticEntries, applyOptimistic] = useOptimistic(entries, applyOptimisticEntry);
  const [pendingKeys, addPending] = useOptimistic<string[], string>([], (s, k) => [...s, k]);
  const [, startTransition] = useTransition();
  const [pinned, setPinned] = useState<ProjectRef[]>([]);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const { toast, show, dismiss } = useToast();

  const matrix = useMemo(() => buildWeekMatrix(days, optimisticEntries, pinned), [days, optimisticEntries, pinned]);
  const shown = new Set(matrix.rows.map((r) => r.projectId));
  const addable = activeProjects.filter((p) => !shown.has(p.id));

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
      const res = await saveCellAction({ date, projectId: project.id, hours, note });
      if (!res.ok) {
        setFailedKey(key);
        show(`Couldn't save ${formatHours(hours)}h on ${formatDayLong(date)}. ${res.message}`, {
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
    if (status !== "work" && logged > 0 && !window.confirm(`Clear ${formatHours(logged)}h on ${formatDayLong(date)}?`)) {
      return;
    }
    startTransition(async () => {
      applyOptimistic({ type: "status", date, status });
      const res = await setDayStatusAction({ date, status });
      if (!res.ok) {
        show(`Couldn't change ${formatDayLong(date)}. ${res.message}`, {
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
          <h1 id="my-time-title" className="text-2xl font-semibold tracking-[-0.01em]">
            My time
          </h1>
          <PeriodSwitcher
            unit="week"
            label={formatWeekRange(days[0], days[6])}
            prevHref={weekHref(prev)}
            nextHref={weekHref(next)}
            todayHref={weekStart === thisWeek ? undefined : weekHref(thisWeek)}
          />
        </div>
        <p className="text-right">
          <span className="block text-xs font-medium text-muted-foreground">Weekly total</span>
          <data value={matrix.weekTotal} className="tabular text-2xl font-semibold">
            {formatHours(matrix.weekTotal)}h
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
          No hours yet. Use “Add project” in the grid, then type a number in any cell, or log from Slack with /log.
        </p>
      ) : null}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
