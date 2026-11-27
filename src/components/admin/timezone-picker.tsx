"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cityName, filterTimezones, offsetLabel, timezoneOptions } from "./timezones";

interface Props {
  id?: string;
  value: string; // IANA
  onChange: (zone: string) => void;
}

/** A29 searchable time zone combobox, shared by the project prompt and office forms. */
export function TimezonePicker({ id, value, onChange }: Props) {
  const listId = useId();
  const t = useTranslations("admin.timezone");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Built only while open: reading a year of offsets for every zone is not free.
  const options = useMemo(() => (open ? timezoneOptions(value) : []), [open, value]);
  const rows = filterTimezones(options, query);
  const selectedIndex = rows.findIndex((row) => row.value === value);
  const current = active < 0 ? Math.max(0, selectedIndex) : Math.min(active, rows.length - 1);

  function setOpenState(next: boolean) {
    setOpen(next);
    setQuery("");
    setActive(-1);
  }

  function pick(zone: string | undefined) {
    if (!zone) return;
    onChange(zone);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length === 0) return;
      const next = (current + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
      setActive(next);
      document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(rows[current]?.value);
    } else if (e.key === "Escape") {
      e.stopPropagation(); // close the picker only, not the surrounding form
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="hit-target h-11 w-full justify-between rounded-lg border-input bg-card font-normal hover:border-input-hover"
        >
          <span suppressHydrationWarning className="truncate">{`${offsetLabel(value)} · ${cityName(value)}`}</span>
          <ChevronsUpDown aria-hidden className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-2"
        onKeyDown={onKeyDown}
      >
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder={t("search")}
          aria-label={t("search")}
          aria-controls={listId}
          aria-activedescendant={rows[current] ? `${listId}-${current}` : undefined}
          autoFocus
          className="h-10"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={t("list")}
          className="min-h-0 max-h-72 overflow-y-auto"
          // Start the list at the saved zone.
          ref={(list) => {
            if (list && active < 0) document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" });
          }}
        >
          {rows.length === 0 ? <li className="px-2 py-3 text-muted-foreground">{t("noMatch")}</li> : null}
          {rows.map((row, i) => (
            <li
              key={row.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={row.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(row.value)}
              className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5", i === current && "bg-accent")}
            >
              <Check aria-hidden className={cn("size-4 shrink-0", row.value === value ? "opacity-100" : "opacity-0")} />
              <span className="flex min-w-0 flex-col">
                <span className="tabular text-xs text-muted-foreground">{row.offset}</span>
                <span>{row.cities}</span>
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
