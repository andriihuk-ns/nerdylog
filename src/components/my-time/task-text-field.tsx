"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { inlineLinks, MAX_LINK_LENGTH } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyEdit, fromMarked, markersIn, removeMarked, setMarkedUrl, toMarked, type Marked } from "./link-markers";

interface Props {
  number: number;
  text: string;
  tooLong: boolean;
  onChange: (text: string) => void;
}

/** `field-sizing: content` grows the textarea by itself; browsers without it get the height set here. */
function fitToContent(element: HTMLTextAreaElement | null) {
  if (!element || CSS.supports("field-sizing", "content")) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

/** The description with link markers, followed by one input per link in the order of the text. */
export function TaskTextField({ number, text, tooLong, onChange }: Props) {
  const t = useTranslations("checklist");
  const [state, setState] = useState<Marked>(() => toMarked(text));
  const area = useRef<HTMLTextAreaElement | null>(null);
  // The text changed outside this field (a link removed, a task above deleted): read it again.
  const marked = fromMarked(state) === text ? state : toMarked(text);
  if (marked !== state) setState(marked);

  function commit(next: Marked, caret: number | null = null) {
    setState(next);
    onChange(fromMarked(next));
    if (caret !== null) requestAnimationFrame(() => area.current?.setSelectionRange(caret, caret));
  }

  /** Pasted links become markers at once; typed ones when the field loses focus. */
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text/plain");
    if (inlineLinks(pasted).length === 0) return;
    event.preventDefault();
    const { selectionStart, selectionEnd, value } = event.currentTarget;
    const before = fromMarked({ ...marked, display: value.slice(0, selectionStart) + pasted });
    const next = toMarked(fromMarked({ ...marked, display: value.slice(0, selectionStart) + pasted + value.slice(selectionEnd) }));
    commit(next, toMarked(before).display.length);
  }

  return (
    <>
      <Textarea
        value={marked.display}
        onChange={(event) => {
          const edit = applyEdit(marked, event.target.value);
          commit({ ...marked, display: edit.display }, edit.caret);
        }}
        onPaste={paste}
        onBlur={() => setState(toMarked(text))}
        rows={3}
        ref={(element) => {
          area.current = element;
          fitToContent(element);
        }}
        placeholder={t("itemPlaceholder")}
        aria-invalid={tooLong || undefined}
        aria-label={t("itemLabel", { number })}
        // The fieldset is the card, so the description has no border, focus ring or error ring of its own.
        className="min-h-19 w-full resize-none rounded-none border-0 bg-transparent px-1 py-2 text-sm hover:border-0 focus-visible:ring-0 focus-visible:outline-none aria-invalid:ring-0 dark:bg-transparent"
      />
      {markersIn(marked).map(({ index, url }) => (
        <div key={index} className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="tabular shrink-0 text-xs text-muted-foreground">
            🔗{index + 1}
          </span>
          <Input
            type="url"
            value={url}
            onChange={(event) => commit(setMarkedUrl(marked, index, event.target.value.trim()))}
            onBlur={() => {
              if (!url) onChange(removeMarked(marked, index));
            }}
            maxLength={MAX_LINK_LENGTH}
            aria-label={t("linkLabel", { number, link: index + 1 })}
            className="h-11 min-w-0 flex-1 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hit-target size-11 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(removeMarked(marked, index))}
            aria-label={t("removeSpecificLink", { number: index + 1 })}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
    </>
  );
}
