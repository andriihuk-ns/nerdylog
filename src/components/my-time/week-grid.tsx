"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IsoDate } from "@/contracts";
import { cn } from "@/lib/utils";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import { isWeekend } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { AddProjectRow } from "./add-project-row";
import type { CommitMove } from "./cell-editor";
import { DAY_STATUS_COLUMN, type DayDisplay } from "./day-status";
import { DayStatusPill } from "./day-status-pill";
import { HoursCell } from "./hours-cell";
import type { MatrixRow, ProjectOption, ProjectRef, WeekMatrix } from "./week-matrix";

interface Props {
  matrix: WeekMatrix;
  /** A16: per-day pill state incl. display-only "weekend" (locks the column). */
  display: DayDisplay[];
  addable: ProjectOption[];
  pendingKeys: readonly string[];
  failedKey: string | null;
  onSaveCell: (project: ProjectRef, date: IsoDate, hours: number, note?: string) => void;
  onSetStatus: (date: IsoDate, status: DayDisplay) => void;
  onRemoveRow: (row: MatrixRow) => void;
  onAddProject: (project: ProjectRef) => void;
}

type Draft = { row: number; col: number; draft: string } | null;

export const cellKey = (projectId: string, date: IsoDate) => `${projectId}:${date}`;

/** Sticky first column: narrower on phones so day columns stay visible at 375px. */
const STICKY = "sticky left-0 z-10 w-[132px] min-w-[132px] max-w-[132px] bg-card text-left sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px]";

export function WeekGrid({ matrix, display, addable, pendingKeys, failedKey, onSaveCell, onSetStatus, onRemoveRow, onAddProject }: Props) {
  const { days, rows } = matrix;
  const { gridRef, focusCell, handleNavKey, cellProps } = useGridNavigation({ rows: rows.length, cols: days.length });
  const [editing, setEditing] = useState<Draft>(null);
  const [note, setNote] = useState<Draft>(null);
  const t = useTranslations("myTime");
  const f = useFormat();

  function close(row: number, col: number, move: CommitMove) {
    setEditing(null);
    setNote(null);
    const next =
      move === "down"
        ? { row: Math.min(row + 1, rows.length - 1), col }
        : move === "right"
          ? { row, col: Math.min(col + 1, days.length - 1) }
          : move === "left"
            ? { row, col: Math.max(col - 1, 0) }
            : { row, col };
    focusCell(next);
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table ref={gridRef} role="grid" aria-label={t("grid.label")} className="w-full border-collapse">
        <thead>
          <tr className="text-xs font-medium text-muted-foreground">
            <th scope="col" className={cn(STICKY, "h-10 border-b px-3 font-medium sm:px-4")}>
              {t("grid.project")}
            </th>
            {days.map((d, i) => {
              const head = f.dayHead(d);
              return (
                <th
                  key={d}
                  scope="col"
                  className={cn(
                    "h-10 border-b px-3 text-center font-medium",
                    DAY_STATUS_COLUMN[display[i]] || (isWeekend(d) && "bg-muted/50"),
                  )}
                >
                  {head.weekday} <span className="tabular">{head.day}</span>
                </th>
              );
            })}
            <th scope="col" className="h-10 border-b px-4 text-right font-semibold text-foreground">
              {t("grid.total")}
            </th>
          </tr>
          <tr>
            <td className={cn(STICKY, "border-b px-3 text-xs text-muted-foreground sm:px-4")}>{t("grid.dayStatus")}</td>
            {days.map((d, i) => (
              <td key={d} className={cn("border-b px-1 py-1", DAY_STATUS_COLUMN[display[i]])}>
                <DayStatusPill
                  status={display[i]}
                  dayLabel={f.dayLong(d)}
                  weekend={isWeekend(d)}
                  hasHours={(matrix.dayTotals[i] ?? 0) > 0}
                  onChange={(s) => onSetStatus(d, s)}
                />
              </td>
            ))}
            <td className="border-b" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => {
            const name = row.projectName || t("unknownProject");
            const project = { id: row.projectId, name };
            return (
              <tr key={row.projectId}>
                <th scope="row" className={cn(STICKY, "group h-11 border-b pr-1 pl-3 font-medium sm:pl-4")}>
                  <span className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate" title={name}>
                      {name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row)}
                      aria-label={t("removeRow", { name })}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-8 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </span>
                </th>
                {row.cells.map((cell, c) => {
                  const date = days[c];
                  const status = display[c];
                  const key = cellKey(row.projectId, date);
                  return (
                    <HoursCell
                      key={date}
                      cell={cell}
                      label={`${name}, ${f.dayLong(date)}`}
                      title={`${name} · ${f.dayLong(date)}`}
                      readOnly={status !== "work"}
                      weekendLocked={status === "weekend"}
                      weekend={isWeekend(date)}
                      columnTint={DAY_STATUS_COLUMN[status]}
                      editing={editing?.row === r && editing.col === c ? editing.draft : null}
                      noteDraft={note?.row === r && note.col === c ? note.draft : null}
                      pending={pendingKeys.includes(key)}
                      failed={failedKey === key}
                      navProps={cellProps(r, c)}
                      onNavKey={handleNavKey}
                      onStartEdit={(draft) => setEditing({ row: r, col: c, draft })}
                      onOpenNote={(draft) => {
                        setEditing(null);
                        setNote({ row: r, col: c, draft });
                      }}
                      onCancel={() => close(r, c, "none")}
                      onCommit={(hours, move, text) => {
                        if (hours !== cell.hours || text !== undefined) onSaveCell(project, date, hours, text);
                        close(r, c, move);
                      }}
                    />
                  );
                })}
                <td className="tabular h-11 border-b px-4 text-right font-semibold">{f.hours(row.total)}</td>
              </tr>
            );
          })}
          <AddProjectRow colSpan={days.length + 2} options={addable} onAdd={onAddProject} />
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <th scope="row" className={cn(STICKY, "h-11 px-3 text-left sm:px-4")}>
              {t("grid.dailyTotal")}
            </th>
            {matrix.dayTotals.map((total, i) => (
              <td key={days[i]} className="tabular h-11 px-3 text-right">
                {total > 0 ? f.hours(total) : <span className="text-muted-foreground">·</span>}
              </td>
            ))}
            <td className="tabular h-11 px-4 text-right">{f.hours(matrix.weekTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
