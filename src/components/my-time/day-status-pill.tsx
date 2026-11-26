"use client";

import { ChevronDown } from "lucide-react";
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
import { DAY_STATUS_LONG, DAY_STATUS_PILL, DAY_STATUS_SHORT } from "./day-status";

interface Props {
  status: EntryType;
  dayLabel: string; // "Tue, Nov 24"
  onChange: (status: EntryType) => void;
}

/** Day-status pill above each grid column. Opens a menu: Work / Vacation / Sick day / Public holiday. */
export function DayStatusPill({ status, dayLabel, onChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${dayLabel}: ${DAY_STATUS_LONG[status]}. Change day status`}
        className={cn(
          "hit-target inline-flex w-full items-center justify-center gap-1 rounded-sm px-2 text-xs font-medium transition-colors duration-[var(--duration-base)] ease-standard",
          DAY_STATUS_PILL[status],
        )}
      >
        {DAY_STATUS_SHORT[status]}
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{dayLabel}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => onChange(v as EntryType)}>
          {ENTRY_TYPES.map((t) => (
            <DropdownMenuRadioItem key={t} value={t}>
              {DAY_STATUS_LONG[t]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
