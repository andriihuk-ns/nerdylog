"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseTimeOfDay, PROMPT_STEP_MINUTES, roundToQuarter } from "@/contracts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 / PROMPT_STEP_MINUTES }, (_, i) => String(i * PROMPT_STEP_MINUTES).padStart(2, "0"));

interface Props {
  id: string;
  value: string; // what the field shows; "HH:MM" once committed
  onChange: (value: string) => void;
  onRounded: (message: string) => void; // only for a typed time that was moved
}

/**
 * A29 prompt time: type any time or pick hours and minutes. Typed values move to the nearest
 * quarter hour when the field is left, and `onRounded` says why.
 */
export function TimePicker({ id, value, onChange, onRounded }: Props) {
  const t = useTranslations("admin.timePicker");
  const [open, setOpen] = useState(false);
  const parsed = parseTimeOfDay(value);
  const [hour, minute] = (parsed ? roundToQuarter(parsed) : "10:00").split(":");

  function commit() {
    if (!parsed) return; // the form reports an invalid time on save
    const rounded = roundToQuarter(parsed);
    if (rounded !== parsed) onRounded(t("rounded", { typed: parsed, value: rounded, step: PROMPT_STEP_MINUTES }));
    if (rounded !== value) onChange(rounded);
  }

  return (
    <div className="relative w-32">
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        required
        onChange={(e) => onChange(e.target.value.replace(/[^0-9:.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="tabular h-11 w-full pr-11"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 size-11" aria-label={t("open")}>
            <Clock aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-36 flex-row gap-1 p-1"
          onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
        >
          <Column label={t("hours")} values={HOURS} selected={hour} onPick={(h) => onChange(`${h}:${minute}`)} />
          <Column
            fill
            label={t("minutes")}
            values={MINUTES}
            selected={minute}
            onPick={(m) => {
              onChange(`${hour}:${m}`);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ColumnProps {
  label: string;
  values: string[];
  selected: string;
  onPick: (value: string) => void;
  fill?: boolean; // stretch the options over the whole height
}

function Column({ label, values, selected, onPick, fill }: ColumnProps) {
  return (
    <ul
      role="listbox"
      aria-label={label}
      className="flex max-h-56 flex-1 flex-col overflow-y-auto"
      ref={(list) => list?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest" })}
    >
      {values.map((v) => (
        <li key={v} role="presentation" className={fill ? "flex-1" : "shrink-0"}>
          <button
            type="button"
            role="option"
            aria-selected={v === selected}
            onClick={() => onPick(v)}
            className={cn(
              "tabular w-full rounded-md text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              fill ? "h-full" : "h-9",
              v === selected ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {v}
          </button>
        </li>
      ))}
    </ul>
  );
}
