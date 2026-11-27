import type { EntryType } from "@/contracts";

/* Short pill labels (docs/05 §6.2) and long menu labels (PRD FR-WEB-02) live in messages/*.json under `dayStatus`. */

/** A16: what the pill shows. "weekend" is display only (no entry type): Sat/Sun with nothing logged. */
export type DayDisplay = EntryType | "weekend";

/**
 * A16 weekend default: a Sat/Sun "work" day with no hours shows "Weekend" (cells locked) until the
 * person picks Work for that day (client state). Once hours exist the day is Work.
 */
export function displayDayStatus(status: EntryType, weekend: boolean, logged: number, unlocked: boolean): DayDisplay {
  return status === "work" && weekend && logged === 0 && !unlocked ? "weekend" : status;
}

/** Pill colours: work neutral, weekend muted, vacation/sick coral, holiday blue-gray. */
export const DAY_STATUS_PILL: Record<DayDisplay, string> = {
  work: "bg-muted text-foreground",
  weekend: "bg-transparent text-muted-foreground ring-1 ring-border ring-inset",
  vacation: "bg-pto-subtle text-pto",
  sick: "bg-pto-subtle text-pto",
  holiday: "bg-holiday-subtle text-holiday",
};

/** Whole-column tint for a PTO day. */
export const DAY_STATUS_COLUMN: Record<DayDisplay, string> = {
  work: "",
  weekend: "",
  vacation: "bg-pto-subtle",
  sick: "bg-pto-subtle",
  holiday: "bg-holiday-subtle",
};
