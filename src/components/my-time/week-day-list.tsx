"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFormat } from "@/hooks/use-format";
import { isWeekend } from "@/components/lib/dates";
import { AddProjectSelect } from "./add-project-row";
import { CellNoteForm } from "./cell-note-form";
import { DayStatusPill } from "./day-status-pill";
import { TaskGroupList } from "./task-group-list";
import type { WeekGridProps } from "./week-grid";

/**
 * Phone layout of the week (below `md`): a strip of the seven days with their totals, then one
 * card per project for the chosen day. Editing opens the same task dialog as the grid.
 */
export function WeekDayList({ matrix, today, display, holidayNames, addable, pendingKeys, failedKey, onSaveCell, onSetStatus, onRemoveRow, onAddProject }: WeekGridProps) {
  const { days, rows } = matrix;
  const t = useTranslations("myTime");
  const f = useFormat();
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // project id
  // Without a pick (or after changing week): today when it is in this week, else Monday.
  const index = Math.max(0, days.indexOf(picked !== null && days.includes(picked) ? picked : today));
  const date = days[index];
  const status = display[index];
  const readOnly = status !== "work";
  const total = matrix.dayTotals[index] ?? 0;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div role="group" aria-label={t("grid.label")} className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const head = f.dayHead(d);
          const hours = matrix.dayTotals[i] ?? 0;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={i === index}
              aria-label={`${f.dayLong(d)}: ${f.hours(hours)}`}
              onClick={() => setPicked(d)}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg border bg-card text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isWeekend(d) && "bg-muted/50",
                i === index && "border-primary bg-primary text-primary-foreground",
              )}
            >
              <span className="truncate">{head.weekday}</span>
              <span className="tabular font-semibold">{head.day}</span>
              <span className="tabular opacity-70">{hours > 0 ? f.hours(hours) : "·"}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="w-40">
          <DayStatusPill
            status={status}
            dayLabel={f.dayLong(date)}
            weekend={isWeekend(date)}
            hasHours={total > 0}
            holidayName={holidayNames.find((h) => h.date === date)?.name}
            onChange={(s) => onSetStatus(date, s)}
          />
        </div>
        <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
          {t("grid.dailyTotal")}
          <span className="tabular text-base font-semibold text-foreground">{f.hours(total)}</span>
        </p>
      </div>
      {rows.map((row) => {
        const name = row.projectName || t("unknownProject");
        const cell = row.cells[index];
        const key = `${row.projectId}:${date}`;
        const label = `${name}, ${f.dayLong(date)}`;
        return (
          <div
            key={row.projectId}
            className={cn(
              "flex flex-col gap-2 rounded-lg border bg-card p-3",
              pendingKeys.includes(key) && "bg-work-subtle",
              failedKey === key && "border-destructive",
            )}
          >
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
              <span className={cn("tabular font-semibold", cell.hours === 0 && "text-muted-foreground")}>
                {readOnly ? "—" : cell.hours > 0 ? f.hours(cell.hours) : "·"}
              </span>
              {readOnly ? null : (
                <Button variant="ghost" size="icon" className="hit-target" onClick={() => setEditing(row.projectId)} aria-label={t("cell.hoursInput", { label })}>
                  {cell.hours > 0 ? <Pencil aria-hidden /> : <Plus aria-hidden />}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="hit-target text-muted-foreground" onClick={() => onRemoveRow(row)} aria-label={t("removeRow", { name })}>
                <X aria-hidden />
              </Button>
            </div>
            {cell.notes.length > 0 ? <TaskGroupList summaries={cell.notes} /> : null}
            <Dialog open={editing === row.projectId} onOpenChange={(open) => !open && setEditing(null)}>
              <DialogContent>
                {editing === row.projectId ? (
                  <CellNoteForm
                    title={`${name} · ${f.dayLong(date)}`}
                    hoursDraft={cell.hours > 0 ? f.hours(cell.hours) : ""}
                    notes={cell.notes}
                    entryCount={cell.entryCount}
                    onSave={(hours, note) => {
                      if (hours !== cell.hours || note !== undefined) onSaveCell({ id: row.projectId, name }, date, hours, note);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : null}
              </DialogContent>
            </Dialog>
          </div>
        );
      })}
      {addable.length > 0 ? <AddProjectSelect options={addable} onAdd={onAddProject} /> : null}
    </div>
  );
}
