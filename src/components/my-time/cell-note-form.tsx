"use client";

import { useState, type FormEvent } from "react";
import { Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  checklistItemLinks,
  MAX_CHECKLIST_ITEMS,
  MAX_TASK_SUMMARY_LENGTH,
  MAX_TASK_TEXT_LENGTH,
  serializeChecklist,
  taskSummaryToItems,
  taskTextLength,
  type ChecklistItem,
} from "@/contracts";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseHoursInput } from "@/components/lib/format";
import { useConfirm } from "@/hooks/use-confirm";
import { ChecklistEditor } from "./checklist-editor";

const QUICK_HOURS = [
  { label: "15m", value: 0.25 },
  { label: "30m", value: 0.5 },
  { label: "1h", value: 1 },
  { label: "2h", value: 2 },
  { label: "4h", value: 4 },
  { label: "8h", value: 8 },
] as const;

interface Props {
  title: string; // "DogTeamPro · Tue, Nov 24"
  hoursDraft: string;
  notes: string[];
  entryCount: number;
  onSave: (hours: number, note: string) => void;
  onCancel: () => void;
}

/** Task editor shared by the project/day cell in My Time and people profiles. */
export function CellNoteForm({ title, hoursDraft, notes, entryCount, onSave, onCancel }: Props) {
  const [hours, setHours] = useState(hoursDraft);
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    const saved = notes.flatMap(taskSummaryToItems).filter((item) => item.text.trim() || checklistItemLinks(item).some((link) => link.trim()));
    return saved.length > 0 ? saved : [{ text: "", done: false }];
  });
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const t = useTranslations("myTime");
  const tc = useTranslations("common");
  const { confirm, dialog } = useConfirm();
  const parsedHours = parseHoursInput(hours);
  const canSave = parsedHours.ok && parsedHours.value > 0 && items.length > 0 && items.every((item) => item.text.trim() && taskTextLength(item.text) <= MAX_TASK_TEXT_LENGTH);

  async function deleteLog() {
    const confirmed = await confirm({
      title: t("note.confirmDelete"),
      description: t("note.confirmDeleteBody"),
      confirmLabel: t("note.delete"),
    });
    if (confirmed) onSave(0, "");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsedHours.ok) {
      setHoursError(t(`input.${parsedHours.error}`));
      return;
    }
    if (parsedHours.value === 0) {
      setHoursError(t("note.hoursRequired"));
      return;
    }
    setHoursError(null);
    if (items.length === 0 || items.some((item) => !item.text.trim())) {
      setFormError(t("note.taskRequired"));
      return;
    }
    // The editor shows which task is over the limit.
    if (items.some((item) => taskTextLength(item.text) > MAX_TASK_TEXT_LENGTH)) return;
    const cleaned = items
      .map((item) => {
        const [link, ...additionalLinks] = checklistItemLinks(item).map((value) => value.trim()).filter(Boolean);
        return {
          text: item.text.trim(),
          ...(link ? { link } : {}),
          ...(additionalLinks.length ? { additionalLinks } : {}),
          done: item.done,
        };
      })
      .filter((item) => item.text.length > 0);
    const summary = cleaned.length > 0 ? serializeChecklist(cleaned) : "";
    if (summary.length > MAX_TASK_SUMMARY_LENGTH) {
      setFormError(t("note.tooLong", { max: MAX_TASK_SUMMARY_LENGTH }));
      return;
    }
    onSave(parsedHours.value, summary);
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="relative shrink-0 border-b px-5 py-4 pr-16 sm:px-6">
        <DialogTitle>{title}</DialogTitle>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 hit-target size-11" aria-label={tc("cancel")}>
            <X aria-hidden className="size-4" />
          </Button>
        </DialogClose>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cell-hours">
              {t("note.hours")}
              <span aria-hidden="true"> *</span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="cell-hours"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                required
                value={hours}
                aria-required="true"
                aria-invalid={hoursError ? true : undefined}
                onChange={(event) => {
                  const raw = event.target.value;
                  const cleaned = raw.replace(/[^0-9.,]/g, "");
                  setHours(cleaned);
                  setHoursError(cleaned !== raw ? t("input.numbersOnly") : null);
                }}
                className="tabular h-11 w-24 text-left"
              />
              <div role="group" aria-label={t("note.quickDurations")} className="flex flex-wrap items-center gap-1">
                {QUICK_HOURS.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant={hours === String(option.value) ? "secondary" : "outline"}
                    className="min-h-11 w-[4.5rem] px-2"
                    aria-pressed={hours === String(option.value)}
                    onClick={() => {
                      setHours(String(option.value));
                      setHoursError(null);
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            {hoursError ? (
              <p role="alert" className="text-xs text-destructive">
                {hoursError}
              </p>
            ) : null}
          </div>
          <section className="flex flex-col gap-2.5" aria-labelledby="task-groups-heading">
            <div className="flex flex-col gap-1">
              <h3 id="task-groups-heading" className="text-sm font-semibold">{t("note.taskNote")}</h3>
              {entryCount > 1 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("note.combinedHint", { count: entryCount })}
                </p>
              ) : null}
            </div>
            <ChecklistEditor
              items={items}
              onChange={(next) => {
                setItems(next);
                setFormError(null);
              }}
              maxItems={MAX_CHECKLIST_ITEMS}
            />
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          </section>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:items-center sm:px-6">
        {entryCount > 0 ? (
          <Button type="button" variant="destructive" className="hit-target w-full sm:mr-auto sm:w-auto" onClick={() => void deleteLog()}>
            <Trash2 aria-hidden className="size-4" />
            {t("note.delete")}
          </Button>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <Button type="button" variant="ghost" className="hit-target w-full sm:w-auto" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          <Button type="submit" className="hit-target w-full sm:w-auto" disabled={!canSave}>
            {tc("save")}
          </Button>
        </div>
      </div>
      {dialog}
    </form>
  );
}
