"use client";

import { useState, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseHoursInput } from "@/components/lib/format";
import { ArtifactChip } from "@/components/shell/artifact-text";
import { ChecklistEditor } from "./checklist-editor";

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
  const [error, setError] = useState<string | null>(null);
  const searchText = checklistSearchText(items);
  const refs = extractTicketRefs(searchText);
  const links = extractArtifactLinks(searchText);
  const t = useTranslations("myTime");
  const tc = useTranslations("common");

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseHoursInput(hours);
    if (!parsed.ok) {
      setError(t(`input.${parsed.error}`));
      return;
    }
    const activeItems = items.filter((item) => item.text.trim() || item.link !== undefined);
    if (activeItems.some((item) => !item.text.trim())) {
      setError(t("note.taskRequired"));
      return;
    }
    if (activeItems.some((item) => item.link !== undefined && !item.link.trim())) {
      setError(t("note.linkRequired"));
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
      setError(t("note.tooLong", { max: MAX_TASK_SUMMARY_LENGTH }));
      return;
    }
    onSave(parsed.value, summary);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cell-hours">{t("note.hours")}</Label>
        <Input
          id="cell-hours"
          inputMode="decimal"
          autoComplete="off"
          value={hours}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            const cleaned = raw.replace(/[^0-9.,]/g, "");
            setHours(cleaned);
            setError(cleaned !== raw ? t("input.numbersOnly") : null);
          }}
          className="tabular h-11 text-right"
        />
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("note.taskNote")}</p>
        {entryCount > 1 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("note.combinedHint", { count: entryCount })}
          </p>
        ) : null}
        <ChecklistEditor
          items={items}
          onChange={(next) => {
            setItems(next);
            setError(null);
          }}
          maxItems={MAX_CHECKLIST_ITEMS}
        />
        {links.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label={t("note.links")}>
            {links.map((l) => (
              <li key={l.url} className="max-w-full">
                <ArtifactChip link={l} />
              </li>
            ))}
          </ul>
        ) : null}
        {refs.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label={t("note.detected")}>
            {refs.map((r) => (
              <li key={r} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                {r}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="hit-target" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" className="hit-target">
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
