"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { ENTRY_TYPES } from "@/contracts";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DAY_STATUS_PILL, type DayDisplay } from "./day-status";

interface Props {
  status: DayDisplay;
  dayLabel: string; // "Tue, Nov 24"
  weekend: boolean; // Sat/Sun → "Weekend" is an option
  hasHours: boolean; // Weekend can't be picked while hours exist
  onChange: (status: DayDisplay) => void;
}

/** Day-status pill above each grid column: (Weekend) / Work / Vacation / Sick day / Public holiday. */
export function DayStatusPill({ status, dayLabel, weekend, hasHours, onChange }: Props) {
  const t = useTranslations("dayStatus");
  const options: DayDisplay[] = weekend ? ["weekend", ...ENTRY_TYPES] : [...ENTRY_TYPES];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("change", { day: dayLabel, status: t(`long.${status}`) })}
        className={cn(
          "hit-target inline-flex w-full items-center justify-center gap-1 rounded-sm px-1.5 text-xs font-medium transition-colors duration-[var(--duration-base)] ease-standard",
          DAY_STATUS_PILL[status],
        )}
      >
        <span className="truncate">{t(`short.${status}`)}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{dayLabel}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => onChange(v as DayDisplay)}>
          {options.map((type) => (
            <DropdownMenuRadioItem key={type} value={type} disabled={type === "weekend" && hasHours} className="min-h-11">
              {t(`long.${type}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
