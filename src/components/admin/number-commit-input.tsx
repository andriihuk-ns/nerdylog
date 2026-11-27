"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { parseBoundedNumber } from "./parse-number";

interface Props {
  value: number | null;
  label: string;
  min: number;
  max: number;
  step: number;
  allowEmpty?: boolean; // empty → null
  format: (n: number) => string;
  className?: string;
  onCommit: (value: number | null) => void;
}

/**
 * Inline numeric field that commits on Enter or blur and reverts on Esc or invalid input.
 * Parent should pass `key={value}` so a server refresh resets the draft.
 */
export function NumberCommitInput({ value, label, min, max, step, allowEmpty = false, format, className, onCommit }: Props) {
  const initial = value === null ? "" : format(value);
  const [draft, setDraft] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  function commit() {
    const parsed = parseBoundedNumber(draft, min, max, step, allowEmpty);
    if (parsed === undefined) {
      setInvalid(true);
      setDraft(initial);
      return;
    }
    setInvalid(false);
    setDraft(parsed === null ? "" : format(parsed));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <Input
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode="decimal"
      autoComplete="off"
      placeholder={allowEmpty ? "—" : undefined}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(initial);
          setInvalid(false);
        }
      }}
      className={cn("tabular h-11 w-24 text-right", className)}
    />
  );
}
