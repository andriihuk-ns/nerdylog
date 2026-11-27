"use client";

import { useState } from "react";
import { Link as LinkIcon, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChecklistItem } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  maxItems?: number;
}

/** Task-first editor: the description gets the flexible width, with compact link/remove actions. */
export function ChecklistEditor({ items, onChange, maxItems = 20 }: Props) {
  const t = useTranslations("checklist");
  const [openLinks, setOpenLinks] = useState<Record<number, boolean>>({});

  function update(index: number, patch: Partial<ChecklistItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function add() {
    if (items.length >= maxItems) return;
    onChange([...items, { text: "", done: false }]);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
    setOpenLinks((previous) => {
      const next: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(previous)) {
        const current = Number(key);
        if (current < index) next[current] = value;
        else if (current > index) next[current - 1] = value;
      }
      return next;
    });
  }

  function toggleLink(index: number) {
    const hasLinkField = Boolean(openLinks[index] || items[index]?.link !== undefined);
    if (hasLinkField) {
      setOpenLinks((previous) => {
        const next = { ...previous };
        delete next[index];
        return next;
      });
      update(index, { link: undefined });
      return;
    }
    setOpenLinks((previous) => ({ ...previous, [index]: true }));
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      {items.map((item, index) => {
        const hasLinkField = Boolean(openLinks[index] || item.link !== undefined);
        return (
          <fieldset key={index} className="flex w-full min-w-0 flex-col gap-2 rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              {t("itemLabel", { number: index + 1 })}
            </legend>
            <div className="flex min-w-0 items-center gap-2">
              <Input
                value={item.text}
                onChange={(event) => update(index, { text: event.target.value })}
                placeholder={t("itemPlaceholder")}
                maxLength={500}
                aria-label={t("itemLabel", { number: index + 1 })}
                className="h-11 min-w-0 flex-1 text-sm"
              />
              <Button
                type="button"
                variant={hasLinkField ? "secondary" : "ghost"}
                size="icon"
                className="hit-target size-11 shrink-0"
                onClick={() => toggleLink(index)}
                title={t(hasLinkField ? "removeLink" : "addLink", { number: index + 1 })}
                aria-label={t(hasLinkField ? "removeLink" : "addLink", { number: index + 1 })}
              >
                <LinkIcon className="size-4" aria-hidden />
              </Button>
              {items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hit-target size-11 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                  title={t("removeItem", { number: index + 1 })}
                  aria-label={t("removeItem", { number: index + 1 })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
            {hasLinkField ? (
              <div className="flex min-w-0 items-center gap-2">
                <LinkIcon aria-hidden className="ml-1 size-4 shrink-0 text-muted-foreground" />
                <Input
                  type="url"
                  value={item.link ?? ""}
                  onChange={(event) => update(index, { link: event.target.value })}
                  placeholder={t("linkPlaceholder")}
                  maxLength={2000}
                  aria-label={t("linkLabel", { number: index + 1 })}
                  className="h-11 min-w-0 flex-1 text-sm"
                />
              </div>
            ) : null}
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
