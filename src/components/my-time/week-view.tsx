"use client";

import { useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { IsoDate, TimeEntryView } from "@/contracts";
import { saveCellAction, setDayStatusAction } from "@/app/(dashboard)/my-time/actions";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { Toast } from "@/components/ui/toast";
import { PeriodSwitcher } from "@/components/shell/period-switcher";
import { addDays, isWeekend, mondayOf, weekDays } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { displayDayStatus, type DayDisplay } from "./day-status";
import { cellKey, WeekGrid } from "./week-grid";
import { applyOptimisticEntry, buildWeekMatrix, type MatrixRow, type ProjectOption, type ProjectRef } from "./week-matrix";

interface Props {
  weekStart: IsoDate;
  today: IsoDate;
  entries: TimeEntryView[];
  /** A15: all active projects; non-members carry a disabledReason. */
  projects: ProjectOption[];
  /** People page: edit this person's week (manager/admin); omitted → the signed-in user. */
  userId?: string;
  /** Page path for week links (`/my-time` or `/people/{id}`). */
  basePath?: string;
  /** Visible heading (people page). My Time keeps an sr-only page heading instead. */
  title?: string;
  /** Right side of the header row (export menus). */
  actions?: ReactNode;
}

/** Weekly matrix client island (My Time and the people page): optimistic state, toasts, confirms, week shortcuts. */
export function WeekView({ weekStart, today, entries, projects, userId, basePath = "/my-time", title, actions }: Props) {
  const weekHref = (d: IsoDate) => `${basePath}?week=${d}`;
  const router = useRouter();
  const t = useTranslations("myTime");
  const tc = useTranslations("common");
  const tDay = useTranslations("dayStatus");
  const f = useFormat();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const [optimisticEntries, applyOptimistic] = useOptimistic(entries, applyOptimisticEntry);
  const [pendingKeys, addPending] = useOptimistic<string[], string>([], (s, k) => [...s, k]);
  const [, startTransition] = useTransition();
  const [pinned, setPinned] = useState<ProjectRef[]>([]);
  const [workWeekends, setWorkWeekends] = useState<IsoDate[]>([]); // A16: Sat/Sun switched to Work
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const { toast, show, dismiss } = useToast();
  const { confirm, dialog } = useConfirm();

  const matrix = useMemo(() => buildWeekMatrix(days, optimisticEntries, pinned), [days, optimisticEntries, pinned]);
  const display: DayDisplay[] = days.map((d, i) =>
    displayDayStatus(matrix.dayStatus[i], isWeekend(d), matrix.dayTotals[i] ?? 0, workWeekends.includes(d)),
  );
  const shown = new Set(matrix.rows.map((r) => r.projectId));
  const addable = projects.filter((p) => !shown.has(p.id));

  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const thisWeek = mondayOf(today);
  useHotkeys({
    "[": () => router.push(weekHref(prev), { scroll: false }),
    "]": () => router.push(weekHref(next), { scroll: false }),
    t: () => router.push(weekHref(thisWeek), { scroll: false }),
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
      } else {
        show(tc("saved"));
      }
    });
  }

  function sendStatus(date: IsoDate, status: TimeEntryView["entryType"]) {
    startTransition(async () => {
      applyOptimistic({ type: "status", date, status });
      const res = await setDayStatusAction({ date, status, userId });
      if (!res.ok) {
        show(t("statusFailed", { day: f.dayLong(date), reason: res.message }), {
          tone: "error",
          onRetry: () => sendStatus(date, status),
        });
      } else {
        show(tc("saved"));
      }
    });
  }

  async function setStatus(date: IsoDate, status: DayDisplay) {
    const i = days.indexOf(date);
    const logged = matrix.dayTotals[i] ?? 0;
    if (status === display[i]) return;
    setWorkWeekends((cur) => (status === "work" ? [...cur, date] : cur.filter((d) => d !== date)));
    const server = status === "weekend" ? "work" : status;
    if (server === matrix.dayStatus[i]) return; // Weekend ↔ Work is client-only
    if (server !== "work" && logged > 0) {
      const ok = await confirm({
        title: t("confirmClear", { hours: f.hours(logged), day: f.dayLong(date) }),
        description: t("confirmClearBody", { status: tDay(`long.${server}`) }),
        confirmLabel: t("clearAction"),
      });
      if (!ok) return;
    }
    sendStatus(date, server);
  }

  async function removeRow(row: MatrixRow) {
    const project = { id: row.projectId, name: row.projectName || t("unknownProject") };
    if (row.total > 0) {
      const ok = await confirm({
        title: t("confirmRemoveRow", { name: project.name }),
        description: t("confirmRemoveRowBody", { hours: f.hours(row.total) }),
        confirmLabel: tc("remove"),
      });
      if (!ok) return;
      row.cells.forEach((cell, c) => cell.hours > 0 && saveCell(project, days[c], 0));
    }
    setPinned((cur) => cur.filter((p) => p.id !== row.projectId));
  }

  const Heading = userId ? "h2" : "h1";
  return (
    <section aria-labelledby="my-time-title" className="flex flex-col gap-4">
      <Heading id="my-time-title" className={userId ? "text-lg font-semibold" : "sr-only"}>
        {title ?? t("title")}
      </Heading>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-start sm:gap-x-6">
          <PeriodSwitcher
            unit="week"
            label={f.weekRange(days[0], days[6])}
            prevHref={weekHref(prev)}
            nextHref={weekHref(next)}
            todayHref={weekStart === thisWeek ? undefined : weekHref(thisWeek)}
          />
          <p className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t("weeklyTotal")}</span>
            <data value={matrix.weekTotal} className="tabular text-xl font-semibold">
              {tc("hours", { value: f.hours(matrix.weekTotal) })}
            </data>
          </p>
        </div>
        {actions}
      </div>
      <WeekGrid
        matrix={matrix}
        display={display}
        addable={addable}
        pendingKeys={pendingKeys}
        failedKey={failedKey}
        onSaveCell={saveCell}
        onSetStatus={(d, s) => void setStatus(d, s)}
        onRemoveRow={(row) => void removeRow(row)}
        onAddProject={pin}
      />
      {matrix.rows.length === 0 ? <p className="text-muted-foreground">{t("empty")}</p> : null}
      <Toast toast={toast} onDismiss={dismiss} />
      {dialog}
    </section>
  );
}
