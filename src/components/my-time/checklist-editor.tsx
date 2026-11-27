"use client";

import { Link as LinkIcon, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  checklistItemLinks,
  inlineLinks,
  MAX_LINK_LENGTH,
  MAX_TASK_TEXT_LENGTH,
  taskTextLength,
  type ChecklistItem,
} from "@/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TaskTextField } from "./task-text-field";

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  maxItems?: number;
}

/** Task-first editor: the description gets the flexible width, with compact link/remove actions. */
export function ChecklistEditor({ items, onChange, maxItems = 20 }: Props) {
  const t = useTranslations("checklist");

  function update(index: number, patch: Partial<ChecklistItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function add() {
    if (items.length >= maxItems) return;
    onChange([...items, { text: "", done: false }]);
  }

  function updateLinks(index: number, links: string[]) {
    update(index, {
      link: links[0],
      additionalLinks: links.length > 1 ? links.slice(1) : undefined,
    });
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      {items.map((item, index) => {
        const links = checklistItemLinks(item);
        const typedCount = inlineLinks(item.text).length;
        const length = taskTextLength(item.text);
        const tooLong = length > MAX_TASK_TEXT_LENGTH;
        return (
          <fieldset
            key={index}
            className={cn("flex w-full min-w-0 flex-col gap-2 rounded-lg border p-3", tooLong && "border-destructive")}
          >
            <legend className="w-fit px-1 text-xs font-medium text-muted-foreground">
              {t("itemLabel", { number: index + 1 })}
            </legend>
            <TaskTextField
              number={index + 1}
              text={item.text}
              tooLong={tooLong}
              onChange={(text) => update(index, { text })}
            />
            {tooLong ? (
              <p role="alert" className="px-1 text-xs text-destructive">
                {t("textTooLong", { count: length, max: MAX_TASK_TEXT_LENGTH })}
              </p>
            ) : null}
            {links.map((link, linkIndex) => (
              <div key={linkIndex} className="flex min-w-0 items-center gap-2">
                <Input
                  type="url"
                  value={link}
                  onChange={(event) => updateLinks(index, links.map((value, current) => current === linkIndex ? event.target.value : value))}
                  placeholder={t("linkPlaceholder")}
                  maxLength={MAX_LINK_LENGTH}
                  aria-label={t("linkLabel", { number: index + 1, link: typedCount + linkIndex + 1 })}
                  className="h-11 min-w-0 flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hit-target size-11 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => updateLinks(index, links.filter((_, current) => current !== linkIndex))}
                  aria-label={t("removeSpecificLink", { number: typedCount + linkIndex + 1 })}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="hit-target h-11 gap-1.5 px-3 text-sm"
                onClick={() => updateLinks(index, [...links, ""])}
                aria-label={t("addLink", { number: index + 1 })}
              >
                <LinkIcon className="size-4" aria-hidden />
                {t("linkAction")}
              </Button>
              {items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hit-target ml-auto size-11 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                  title={t("removeItem", { number: index + 1 })}
                  aria-label={t("removeItem", { number: index + 1 })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </fieldset>
        );
      })}
      {items.length < maxItems ? (
        <Button type="button" variant="outline" onClick={add} className="hit-target h-11 w-fit px-3 text-sm">
          <Plus className="size-4" aria-hidden />
          {t("addItem")}
        </Button>
      ) : null}
    </div>
  );
}
