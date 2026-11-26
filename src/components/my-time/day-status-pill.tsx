"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { ENTRY_TYPES, type EntryType } from "@/contracts";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DAY_STATUS_PILL } from "./day-status";

interface Props {
  status: EntryType;
  dayLabel: string; // "Tue, Nov 24"
  onChange: (status: EntryType) => void;
}

/** Day-status pill above each grid column. Opens a menu: Work / Vacation / Sick day / Public holiday. */
export function DayStatusPill({ status, dayLabel, onChange }: Props) {
  const t = useTranslations("dayStatus");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("change", { day: dayLabel, status: t(`long.${status}`) })}
        className={cn(
          "hit-target inline-flex w-full items-center justify-center gap-1 rounded-sm px-2 text-xs font-medium transition-colors duration-[var(--duration-base)] ease-standard",
          DAY_STATUS_PILL[status],
        )}
      >
        {t(`short.${status}`)}
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{dayLabel}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => onChange(v as EntryType)}>
          {ENTRY_TYPES.map((type) => (
            <DropdownMenuRadioItem key={type} value={type}>
              {t(`long.${type}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
