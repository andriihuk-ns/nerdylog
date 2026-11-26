import type { EntryType } from "@/contracts";

/** Display helpers for the PDF (pure). */

export function hoursLabel(hours: number): string {
  return hours.toFixed(2);
}

export function daysLabel(days: number): string {
  return days.toFixed(1);
}

const ENTRY_LABELS: Record<EntryType, string> = {
  work: "Work",
  vacation: "Vacation",
  sick: "Sick",
  holiday: "Holiday",
};

export function entryTypeLabel(type: EntryType): string {
  return ENTRY_LABELS[type];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11" → "Nov 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}
