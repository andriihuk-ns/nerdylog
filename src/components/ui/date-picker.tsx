"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, firstDayOfMonth, isIsoDate, isMonth, mondayOf, todayIn, weekDays } from "@/components/lib/dates";
import { useFormat } from "@/hooks/use-format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerMode = "date" | "week" | "month" | "year";

interface Props {
  value: string;
  mode?: DatePickerMode;
  label: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  iconOnly?: boolean;
  placeholder?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function DatePicker({ value, mode = "date", label, onChange, id, className, iconOnly = false, placeholder }: Props) {
  const locale = useLocale();
  const t = useTranslations("period");
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"days" | "months" | "years">(mode === "date" || mode === "week" ? "days" : mode === "month" ? "months" : "years");
  const fallbackDate = isIsoDate(value) ? value : todayIn();
  const hasSelection = mode === "year" ? /^\d{4}$/.test(value) : mode === "month" ? isMonth(value) : isIsoDate(value);
  const initialCursorMonth = mode === "month" && isMonth(value) ? value : fallbackDate.slice(0, 7);
  const [cursorMonth, setCursorMonth] = useState(initialCursorMonth);
  const selectedYear = mode === "year" && /^\d{4}$/.test(value) ? Number(value) : Number(fallbackDate.slice(0, 4));
  const cursorYear = Number(cursorMonth.slice(0, 4));
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  const shortMonthFormatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const selectedMonth = mode === "month" && hasSelection ? value : hasSelection ? fallbackDate.slice(0, 7) : "";
  const selectedDate = mode === "date" || mode === "week" ? fallbackDate : firstDayOfMonth(`${selectedYear}-${pad(Number(value.slice(5, 7)) || 1)}`);

  function navigate(delta: number) {
    if (panel === "days" || panel === "months") {
      setCursorMonth(`${cursorYear + delta}-${cursorMonth.slice(5, 7)}`);
      return;
    }
    setCursorMonth(`${Math.floor(cursorYear / 12) * 12 + delta * 12}-01`);
  }

  function choose(valueToSet: string) {
    onChange(valueToSet);
    setOpen(false);
  }

  function selectedClass(selected: boolean) {
    return cn("h-11 min-w-11 rounded-md px-1 text-sm", selected ? "bg-muted text-foreground hover:bg-muted" : "hover:bg-muted");
  }

  const display = !value ? placeholder ?? label : mode === "year" ? value : mode === "month" ? f.month(value) : f.dayLong(fallbackDate);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPanel(mode === "date" || mode === "week" ? "days" : mode === "month" ? "months" : "years");
          setCursorMonth(initialCursorMonth);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant={iconOnly ? "ghost" : "outline"}
          size={iconOnly ? "icon" : "default"}
          aria-label={label}
          className={cn("hit-target h-11", iconOnly ? "w-11 shrink-0 p-0" : "w-full justify-between rounded-lg bg-card px-3 text-left font-normal", className)}
        >
          {iconOnly ? <CalendarDays aria-hidden className="size-4" /> : <><span className="truncate">{display}</span><CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" /></>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-1rem)] max-w-[22rem] gap-3 p-3">
        <div className="flex h-11 items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon" className="hit-target size-11" aria-label={t("previous", { unit: panel === "years" ? "year" : panel === "months" ? "year" : "month" })} onClick={() => navigate(-1)}>
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <div className="flex min-w-0 items-center justify-center gap-1">
            {panel === "days" ? (
              <>
                <Button type="button" variant="ghost" className="hit-target min-w-0 px-2 font-semibold" onClick={() => setPanel("months")}>
                  {monthFormatter.format(new Date(`${cursorMonth}-01T00:00:00Z`))}
                </Button>
                <Button type="button" variant="ghost" className="hit-target px-2 font-semibold" onClick={() => setPanel("years")}>
                  {cursorYear}
                </Button>
              </>
            ) : panel === "months" ? (
              <Button type="button" variant="ghost" className="hit-target font-semibold" onClick={() => setPanel("years")}>
                {cursorYear}
              </Button>
            ) : (
              <span className="text-sm font-semibold">{Math.floor(cursorYear / 12) * 12}–{Math.floor(cursorYear / 12) * 12 + 11}</span>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" className="hit-target size-11" aria-label={t("next", { unit: panel === "years" ? "year" : panel === "months" ? "year" : "month" })} onClick={() => navigate(1)}>
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>

        {panel === "days" ? (
          <div role="grid" aria-label={f.month(cursorMonth)} className="flex flex-col gap-1">
            <div role="row" className="grid grid-cols-7">
              {weekDays("2024-01-01").map((date) => (
                <span key={date} role="columnheader" className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground">
                  {f.dayHead(date).weekday}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, row) => {
              const start = mondayOf(firstDayOfMonth(cursorMonth));
              const dates = Array.from({ length: 7 }, (_, col) => addDays(start, row * 7 + col));
              return (
                <div role="row" key={row} className="grid grid-cols-7">
                  {dates.map((date) => {
                    const sameMonth = date.slice(0, 7) === cursorMonth;
                    const inWeek = hasSelection && mode === "week" && mondayOf(date) === mondayOf(selectedDate);
                    const selected = hasSelection && (mode === "week" ? date === mondayOf(selectedDate) : date === selectedDate);
                    return (
                      <Button
                        key={date}
                        type="button"
                        role="gridcell"
                        aria-label={f.dayLong(date)}
                        aria-selected={selected}
                        variant="ghost"
                        className={cn(selectedClass(selected), !sameMonth && "text-muted-foreground/60", inWeek && !selected && "bg-muted")}
                        onClick={() => choose(date)}
                      >
                        {Number(date.slice(8, 10))}
                      </Button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : null}

        {panel === "months" ? (
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 12 }, (_, index) => {
              const month = `${cursorYear}-${pad(index + 1)}`;
              const selected = hasSelection && month === selectedMonth;
              return (
                <Button
                  key={month}
                  type="button"
                  variant="ghost"
                  aria-pressed={selected}
                  className={selectedClass(selected)}
                  onClick={() => mode === "month" ? choose(month) : (setCursorMonth(month), setPanel("days"))}
                >
                  {shortMonthFormatter.format(new Date(`${month}-01T00:00:00Z`))}
                </Button>
              );
            })}
          </div>
        ) : null}

        {panel === "years" ? (
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 12 }, (_, index) => {
              const year = Math.floor(cursorYear / 12) * 12 + index;
              const selected = hasSelection && year === selectedYear;
              return (
                <Button
                  key={year}
                  type="button"
                  variant="ghost"
                  aria-pressed={selected}
                  className={selectedClass(selected)}
                  onClick={() => mode === "year" ? choose(String(year)) : (setCursorMonth(`${year}-${cursorMonth.slice(5, 7)}`), setPanel("months"))}
                >
                  {year}
                </Button>
              );
            })}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
