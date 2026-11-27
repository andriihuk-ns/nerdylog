"use client";

import type { KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useFormat } from "@/hooks/use-format";
import { ArtifactText } from "@/components/shell/artifact-text";
import { CellEditor, type CommitMove } from "./cell-editor";
import { CellNoteForm } from "./cell-note-form";
import type { MatrixCell } from "./week-matrix";

export interface HoursCellProps {
  cell: MatrixCell;
  label: string; // "DogTeamPro, Tue, Nov 24"
  title: string; // "DogTeamPro · Tue, Nov 24" (note popover heading)
  readOnly: boolean; // PTO day or locked weekend
  weekendLocked?: boolean; // A16: Sat/Sun still on "Weekend"
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
  const t = useTranslations("myTime.cell");
  const f = useFormat();
  const current = p.cell.hours > 0 ? f.hours(p.cell.hours) : "";

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

  const hours = f.hours(p.cell.hours);
  const spoken = p.weekendLocked
    ? t("weekend")
    : p.readOnly
      ? t("timeOff")
      : p.cell.notes.length > 0
        ? t("spokenWithNote", { hours, notes: p.cell.notes.join("; ") })
        : t("spoken", { hours });

  return (
    <td
      role="gridcell"
      {...p.navProps}
      aria-readonly={p.readOnly || undefined}
      aria-label={`${p.label}: ${spoken}`}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (!p.readOnly && p.editing === null && p.noteDraft === null) {
          p.onStartEdit(current);
        }
      }}
      className={cn(
        "relative min-w-[64px] border-b p-0 text-right outline-none transition-colors duration-[var(--duration-base)] ease-standard",
        "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
        p.weekend && !p.columnTint && "bg-muted/50",
        p.columnTint,
        !p.readOnly && "cursor-text",
        !p.readOnly && p.editing === null && "hover:bg-muted/60 hover:ring-1 hover:ring-ring/40 hover:ring-inset",
        p.pending && "bg-work-subtle",
        p.failed && "ring-1 ring-destructive ring-inset",
      )}
    >
      <Popover open={p.noteDraft !== null} onOpenChange={(open) => !open && p.onCancel()}>
        <PopoverAnchor asChild>
          <div className="min-h-11">
            {p.editing !== null ? (
              <CellEditor
                initial={p.editing}
                label={t("hoursInput", { label: p.label })}
                onCommit={(h, move) => p.onCommit(h, move)}
                onCancel={p.onCancel}
                onOpenNote={p.onOpenNote}
              />
            ) : (
              <div className="flex min-h-11 flex-col items-end justify-center gap-1 px-3 py-2">
                <span className={cn("tabular font-medium", p.cell.hours === 0 && "text-muted-foreground")}>
                  {p.weekendLocked ? "" : p.readOnly ? "—" : p.cell.hours > 0 ? hours : "·"}
                </span>
                {p.cell.notes.length > 0 ? (
                  <ul className="w-full space-y-1 text-left text-xs leading-snug text-muted-foreground">
                    {p.cell.notes.map((summary, index) => (
                      <li key={`${index}-${summary}`} onClick={(event) => event.stopPropagation()}>
                        <ArtifactText text={summary} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-80">
          {p.noteDraft !== null ? (
            <CellNoteForm
              title={p.title}
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
