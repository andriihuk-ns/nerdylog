"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SEGMENT_ACTIVE, SEGMENT_BASE, SEGMENT_TRACK } from "./segmented-styles";

export interface SegmentOption<T extends string> {
  value: T;
  content: ReactNode;
  /** Accessible name when `content` is an icon or an abbreviation. */
  ariaLabel?: string;
  title?: string;
  lang?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  busy?: boolean;
  className?: string;
}

/**
 * Radio group in the segmented-tabs style. Arrow keys move and select (roving tabindex);
 * choosing applies at once.
 */
export function SegmentedControl<T extends string>({ label, value, options, onChange, busy, className }: Props<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    const next = options[(i + delta + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    refs.current[next.value]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-busy={busy || undefined}
      onKeyDown={onKeyDown}
      className={cn(SEGMENT_TRACK, "h-7", className)}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[o.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            title={o.title}
            lang={o.lang}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(SEGMENT_BASE, "focus-visible:ring-2 focus-visible:ring-ring", checked && SEGMENT_ACTIVE)}
          >
            {o.content}
          </button>
        );
      })}
    </div>
  );
}
