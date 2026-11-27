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

/** Dynamic checklist editor: each item has a done checkbox, text, optional link field, and remove button. */
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
    if (items.length <= 1) {
      onChange([{ text: "", done: false }]);
      setOpenLinks({});
      return;
    }
    onChange(items.filter((_, i) => i !== index));
    setOpenLinks((prev) => {
      const next: Record<number, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < index) next[idx] = v;
        else if (idx > index) next[idx - 1] = v;
      }
      return next;
    });
  }

  function toggleLink(index: number) {
    const isVisible = Boolean(openLinks[index] || items[index]?.link !== undefined);
    if (isVisible) {
      setOpenLinks((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      update(index, { link: undefined });
    } else {
      setOpenLinks((prev) => ({ ...prev, [index]: true }));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const hasLinkField = Boolean(openLinks[i] || item.link !== undefined);
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) => update(i, { done: e.target.checked })}
                className="size-4 shrink-0 cursor-pointer accent-primary"
                aria-label={t("toggleDone")}
              />
              <Input
                autoFocus={i === 0}
                value={item.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder={t("itemPlaceholder")}
                maxLength={500}
                className="h-9 flex-1 text-sm"
              />
              <Button
                type="button"
                variant={hasLinkField ? "secondary" : "ghost"}
                size="icon"
                className="size-9 shrink-0"
                onClick={() => toggleLink(i)}
                title={hasLinkField ? t("removeLink") : t("addLink")}
                aria-label={hasLinkField ? t("removeLink") : t("addLink")}
              >
                <LinkIcon className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
                title={t("removeItem")}
                aria-label={t("removeItem")}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
            {hasLinkField ? (
              <Input
                type="url"
                value={item.link ?? ""}
                onChange={(e) => update(i, { link: e.target.value })}
                placeholder={t("linkPlaceholder")}
                maxLength={2000}
                className="ml-5.5 h-8 w-[calc(100%-1.375rem)] text-xs"
              />
            ) : null}
          </div>
        );
      })}
      {items.length < maxItems ? (
        <Button type="button" variant="ghost" size="sm" onClick={add} className="h-8 self-start px-2 text-xs">
          <Plus className="mr-1 size-3.5" aria-hidden />
          {t("addItem")}
        </Button>
      ) : null}
    </div>
  );
}

