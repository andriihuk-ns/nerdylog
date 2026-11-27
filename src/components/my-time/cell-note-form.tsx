"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  checklistSearchText,
  extractArtifactLinks,
  extractTicketRefs,
  MAX_CHECKLIST_ITEMS,
  MAX_TASK_SUMMARY_LENGTH,
  serializeChecklist,
  taskSummaryToItems,
  type ChecklistItem,
} from "@/contracts";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseHoursInput } from "@/components/lib/format";
import { ArtifactChip } from "@/components/shell/artifact-text";
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
    const saved = notes.flatMap(taskSummaryToItems).filter((item) => item.text.trim() || item.link?.trim());
    return saved.length > 0 ? saved : [{ text: "", done: false }];
  });
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const searchText = checklistSearchText(items);
  const refs = extractTicketRefs(searchText);
  const links = extractArtifactLinks(searchText);
  const t = useTranslations("myTime");
  const tc = useTranslations("common");
  const isNewEntry = entryCount === 0;
  const parsedHours = parseHoursInput(hours);
  const canSave = parsedHours.ok && (!isNewEntry || parsedHours.value > 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsedHours.ok) {
      setHoursError(t(`input.${parsedHours.error}`));
      return;
    }
    if (isNewEntry && parsedHours.value === 0) {
      setHoursError(t("note.hoursRequired"));
      return;
    }
    setHoursError(null);
    const activeItems = items.filter((item) => item.text.trim() || item.link !== undefined);
    if (activeItems.some((item) => !item.text.trim())) {
      setFormError(t("note.taskRequired"));
      return;
    }
    if (activeItems.some((item) => item.link !== undefined && !item.link.trim())) {
      setFormError(t("note.linkRequired"));
      return;
    }
    const cleaned = items
      .map((item) => ({
        text: item.text.trim(),
        ...(item.link?.trim() ? { link: item.link.trim() } : {}),
        done: item.done,
      }))
      .filter((item) => item.text.length > 0 || Boolean(item.link));
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
        <DialogDescription>{t("note.modalDescription")}</DialogDescription>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 hit-target size-11" aria-label={tc("cancel")}>
            <X aria-hidden className="size-4" />
          </Button>
        </DialogClose>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex max-w-sm flex-col gap-1.5">
            <Label htmlFor="cell-hours">
              {t("note.hours")}
              {isNewEntry ? <span aria-hidden="true"> *</span> : null}
            </Label>
            <Input
              id="cell-hours"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              required={isNewEntry}
              value={hours}
              aria-required={isNewEntry || undefined}
              aria-invalid={hoursError ? true : undefined}
              onChange={(event) => {
                const raw = event.target.value;
                const cleaned = raw.replace(/[^0-9.,]/g, "");
                setHours(cleaned);
                setHoursError(cleaned !== raw ? t("input.numbersOnly") : null);
              }}
              className="tabular h-11 w-40 text-left"
            />
            <div role="group" aria-label={t("note.quickDurations")} className="flex max-w-sm flex-wrap gap-1.5">
              {QUICK_HOURS.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  size="sm"
                  variant={hours === String(option.value) ? "secondary" : "outline"}
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
            {links.length > 0 ? (
              <ul className="flex flex-wrap gap-1" aria-label={t("note.links")}>
                {links.map((link) => (
                  <li key={link.url} className="max-w-full">
                    <ArtifactChip link={link} />
                  </li>
                ))}
              </ul>
            ) : null}
            {refs.length > 0 ? (
              <ul className="flex flex-wrap gap-1" aria-label={t("note.detected")}>
                {refs.map((reference) => (
                  <li key={reference} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {reference}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-end sm:px-6">
        <Button type="button" variant="ghost" className="hit-target w-full sm:w-auto" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" className="hit-target w-full sm:w-auto" disabled={!canSave}>
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
