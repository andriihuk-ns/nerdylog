"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

/** Compact labelled Select for list filters (project, office). */
export function FilterSelect({ label, value, options, onChange, className }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn("hit-target w-48", className)}>
        <SelectValue className="min-w-0 flex-1 truncate" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
