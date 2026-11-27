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
}

/**
 * A29 prompt time: type any time or pick hours and minutes. Typed values move to the nearest
 * quarter hour when the field is left, with a hint saying why.
 */
export function TimePicker({ id, value, onChange }: Props) {
  const t = useTranslations("admin.timePicker");
  const [open, setOpen] = useState(false);
  // A value saved before A29 is rounded as soon as the form opens, and says so.
  const [roundedFrom, setRoundedFrom] = useState<string | null>(() => {
    const parsed = parseTimeOfDay(value);
    return parsed && roundToQuarter(parsed) !== parsed ? parsed : null;
  });
  const parsed = parseTimeOfDay(value);
  const shown = roundedFrom && parsed ? roundToQuarter(parsed) : value;
  const [hour, minute] = (parsed ? roundToQuarter(parsed) : "10:00").split(":");

  function commit(raw: string) {
    const typed = parseTimeOfDay(raw);
    if (!typed) return; // the form reports an invalid time on save
    const rounded = roundToQuarter(typed);
    if (rounded !== typed) setRoundedFrom(typed);
    onChange(rounded);
  }

  function pick(next: string) {
    setRoundedFrom(null);
    onChange(next);
  }

  return (
    <div className="flex w-40 flex-col gap-1.5">
      <div className="relative w-full">
        <Input
          id={id}
          value={shown}
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          required
          aria-describedby={roundedFrom ? `${id}-hint` : undefined}
          onChange={(e) => pick(e.target.value.replace(/[^0-9:.]/g, ""))}
          onBlur={() => commit(shown)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(shown);
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
            <Column label={t("hours")} values={HOURS} selected={hour} onPick={(h) => pick(`${h}:${minute}`)} />
            <Column
              label={t("minutes")}
              values={MINUTES}
              selected={minute}
              onPick={(m) => {
                pick(`${hour}:${m}`);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {roundedFrom && parsed ? (
        <p id={`${id}-hint`} role="status" className="text-xs text-muted-foreground">
          {t("rounded", { typed: roundedFrom, value: roundToQuarter(parsed), step: PROMPT_STEP_MINUTES })}
        </p>
      ) : null}
    </div>
  );
}

function Column({ label, values, selected, onPick }: { label: string; values: string[]; selected: string; onPick: (v: string) => void }) {
  return (
    <ul
      role="listbox"
      aria-label={label}
      className="max-h-56 flex-1 overflow-y-auto"
      ref={(list) => list?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest" })}
    >
      {values.map((v) => (
        <li key={v} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={v === selected}
            onClick={() => onPick(v)}
            className={cn(
              "tabular h-9 w-full rounded-md text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
