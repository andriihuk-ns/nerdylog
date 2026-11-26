"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { formatHours } from "@/components/lib/format";
import { CellEditor, type CommitMove } from "./cell-editor";
import { CellNoteForm } from "./cell-note-form";
import type { MatrixCell } from "./week-matrix";

export interface HoursCellProps {
  cell: MatrixCell;
  label: string; // "DogTeamPro, Tue, Nov 24"
  readOnly: boolean; // PTO day
  weekend: boolean;
  columnTint: string;
  editing: string | null; // initial draft when editing
  noteDraft: string | null; // non-null → popover open
  pending: boolean;
  failed: boolean;
  navProps: { "data-row": number; "data-col": number; tabIndex: number; onFocus: () => void };
  onNavKey: (e: KeyboardEvent) => boolean;
  onStartEdit: (draft: string) => void;
  onOpenNote: (draft: string) => void;
  onCommit: (hours: number, move: CommitMove, note?: string) => void;
  onCancel: () => void;
}

const DRAFT_KEY = /^[0-9.,]$/;

export function HoursCell(p: HoursCellProps) {
  const current = p.cell.hours > 0 ? formatHours(p.cell.hours) : "";

  function onKeyDown(e: KeyboardEvent<HTMLTableCellElement>) {
    if (p.editing !== null || p.noteDraft !== null || e.target !== e.currentTarget) return;
    if (p.onNavKey(e)) return;
    if (p.readOnly) return;
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      p.onOpenNote(current);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      p.onStartEdit(current);
    } else if (DRAFT_KEY.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      p.onStartEdit(e.key);
    } else if ((e.key === "Delete" || e.key === "Backspace") && p.cell.hours > 0) {
      e.preventDefault();
      p.onCommit(0, "none");
    }
  }

  const spoken = p.readOnly
    ? "time off"
    : `${formatHours(p.cell.hours)} hours${p.cell.notes.length > 0 ? `, note: ${p.cell.notes.join("; ")}` : ""}`;

  return (
    <td
      role="gridcell"
      {...p.navProps}
      aria-readonly={p.readOnly || undefined}
      aria-label={`${p.label}: ${spoken}`}
      onKeyDown={onKeyDown}
      onDoubleClick={() => !p.readOnly && p.onStartEdit(current)}
      onClick={(e) => e.currentTarget.focus()}
      className={cn(
        "relative h-11 min-w-[72px] border-b p-0 text-right outline-none transition-colors duration-[var(--duration-base)] ease-standard",
        "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
        p.weekend && !p.columnTint && "bg-muted/50",
        p.columnTint,
        !p.readOnly && "cursor-cell",
        p.pending && "bg-work-subtle",
        p.failed && "ring-1 ring-destructive ring-inset",
      )}
    >
      <Popover open={p.noteDraft !== null} onOpenChange={(open) => !open && p.onCancel()}>
        <PopoverAnchor asChild>
          <div className="h-full">
            {p.editing !== null ? (
              <CellEditor
                initial={p.editing}
                label={`${p.label}, hours`}
                onCommit={(h, move) => p.onCommit(h, move)}
                onCancel={p.onCancel}
                onOpenNote={p.onOpenNote}
              />
            ) : (
              <span
                className={cn(
                  "tabular flex h-11 items-center justify-end gap-1 px-3 font-medium",
                  p.cell.hours === 0 && "text-muted-foreground",
                )}
              >
                {p.cell.notes.length > 0 ? (
                  <span aria-hidden className="size-1 rounded-full bg-muted-foreground/60" title="Has a task note" />
                ) : null}
                {p.readOnly ? "—" : p.cell.hours > 0 ? formatHours(p.cell.hours) : "·"}
              </span>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-80">
          {p.noteDraft !== null ? (
            <CellNoteForm
              title={p.label.replace(", ", " · ")}
              hoursDraft={p.noteDraft}
              notes={p.cell.notes}
              entryCount={p.cell.entryCount}
              onSave={(h, note) => p.onCommit(h, "none", note)}
              onCancel={p.onCancel}
            />
          ) : null}
        </PopoverContent>
      </Popover>
    </td>
  );
}
