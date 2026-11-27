"use client";

import { Link as LinkIcon, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { checklistItemLinks, MAX_CHECKLIST_LINKS, type ChecklistItem } from "@/contracts";
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
              {links.length < MAX_CHECKLIST_LINKS ? (
                <Button
                  type="button"
                  variant={links.length ? "ghost" : "outline"}
                  className="hit-target h-11 shrink-0 gap-1.5 px-3 text-sm"
                  onClick={() => updateLinks(index, [...links, ""])}
                  aria-label={t("addLink", { number: index + 1 })}
                >
                  <LinkIcon className="size-4" aria-hidden />
                  {t(links.length ? "addAnotherLink" : "linkAction")}
                </Button>
              ) : null}
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
            {links.map((link, linkIndex) => (
              <div key={linkIndex} className="flex min-w-0 items-center gap-2">
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <LinkIcon aria-hidden className="size-4" />
                  {t("linkNumber", { number: linkIndex + 1 })}
                </span>
                <Input
                  type="url"
                  value={link}
                  onChange={(event) => updateLinks(index, links.map((value, current) => current === linkIndex ? event.target.value : value))}
                  placeholder={t("linkPlaceholder")}
                  maxLength={2000}
                  aria-label={t("linkLabel", { number: index + 1, link: linkIndex + 1 })}
                  className="h-11 min-w-0 flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hit-target size-11 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => updateLinks(index, links.filter((_, current) => current !== linkIndex))}
                  aria-label={t("removeSpecificLink", { number: linkIndex + 1 })}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
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
