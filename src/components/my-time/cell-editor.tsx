"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { parseHoursInput } from "@/components/lib/format";

export type CommitMove = "down" | "right" | "left" | "none";

interface Props {
  initial: string;
  label: string; // accessible name: "DogTeamPro, Tue, Nov 24, hours"
  onCommit: (hours: number, move: CommitMove) => void;
  onCancel: () => void;
  onOpenNote: (draft: string) => void;
}

/**
 * Inline hours input. Enter commits + moves down, Tab commits + moves right,
 * Shift+Enter opens the note popover, Esc cancels. Blur commits in place.
 */
export function CellEditor({ initial, label, onCommit, onCancel, onOpenNote }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const errorId = useId();

  function commit(move: CommitMove) {
    if (done.current) return;
    const parsed = parseHoursInput(value);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    done.current = true;
    onCommit(parsed.value, move);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      done.current = true;
      onOpenNote(value);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit("down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(e.shiftKey ? "left" : "right");
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      done.current = true;
      onCancel();
    }
  }

  return (
    <div className="relative h-full">
      <input
        autoFocus
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Leaving with an invalid value reverts instead of trapping focus.
          if (parseHoursInput(value).ok) commit("none");
          else if (!done.current) {
            done.current = true;
            onCancel();
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="tabular h-11 w-full bg-card px-3 text-right font-medium outline-none ring-2 ring-ring ring-inset aria-invalid:ring-destructive"
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="absolute top-full right-0 z-20 mt-1 rounded-sm bg-popover px-2 py-1 text-xs whitespace-nowrap text-destructive shadow-[0_8px_24px_rgb(0_0_0/0.08)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
