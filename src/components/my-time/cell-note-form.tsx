"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { extractArtifactLinks, extractTicketRefs } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseHoursInput } from "@/components/lib/format";
import { ArtifactChip, ArtifactText } from "@/components/shell/artifact-text";

interface Props {
  title: string; // "DogTeamPro · Tue, Nov 24"
  hoursDraft: string;
  notes: string[];
  entryCount: number;
  onSave: (hours: number, note: string) => void;
  onCancel: () => void;
}

/** Shift+Enter popover: hours + task note, with live ticket-ref detection (DOG-1364). */
export function CellNoteForm({ title, hoursDraft, notes, entryCount, onSave, onCancel }: Props) {
  const [hours, setHours] = useState(hoursDraft);
  const [note, setNote] = useState(notes[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const refs = extractTicketRefs(note);
  const links = extractArtifactLinks(note);
  const t = useTranslations("myTime");
  const tc = useTranslations("common");

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseHoursInput(hours);
    if (!parsed.ok) return setError(t(`input.${parsed.error}`));
    onSave(parsed.value, note.trim());
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
            setHours(e.target.value);
            setError(null);
          }}
          className="tabular h-11 text-right"
        />
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cell-note">{entryCount > 1 ? t("note.taskNoteFirst") : t("note.taskNote")}</Label>
        <Textarea
          id="cell-note"
          autoFocus
          rows={3}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("note.placeholder")}
          aria-describedby="cell-note-hint"
        />
        <p id="cell-note-hint" className="text-xs text-muted-foreground">
          {t("note.linksHint")}
        </p>
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
        {entryCount > 1 ? (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {notes.slice(1).map((n, i) => (
              <li key={i}>
                <ArtifactText text={n} />
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
