"use client";

import { useId, type ReactNode } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { SEGMENT_ACTIVE, SEGMENT_BASE, SEGMENT_TRACK } from "./segmented-styles";

export interface MenuSegment<T extends string> {
  value: T;
  content: ReactNode;
  ariaLabel: string;
  title?: string;
  lang?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly MenuSegment<T>[];
  onChange: (value: T) => void;
}

/**
 * One inline avatar-menu row: label left, compact segmented control right (~28px tall).
 * Segments are real `menuitemradio`s so ↑/↓ reach them; choosing keeps the menu open.
 */
export function MenuSegmentedRow<T extends string>({ label, value, options, onChange }: Props<T>) {
  const labelId = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-1.5">
      <span id={labelId} className="text-sm">
        {label}
      </span>
      <DropdownMenuPrimitive.RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(v) => {
          const next = options.find((o) => o.value === v);
          if (next) onChange(next.value);
        }}
        className={cn(SEGMENT_TRACK, "h-7")}
      >
        {options.map((o) => (
          <DropdownMenuPrimitive.RadioItem
            key={o.value}
            value={o.value}
            aria-label={o.ariaLabel}
            title={o.title}
            lang={o.lang}
            onSelect={(e) => e.preventDefault()}
            className={cn(
              SEGMENT_BASE,
              "cursor-default data-highlighted:ring-2 data-highlighted:ring-ring",
              o.value === value && SEGMENT_ACTIVE,
            )}
          >
            {o.content}
          </DropdownMenuPrimitive.RadioItem>
        ))}
      </DropdownMenuPrimitive.RadioGroup>
    </div>
  );
}
