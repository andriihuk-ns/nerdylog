import type { EntryType } from "@/contracts";

/* Short pill labels (docs/05 §6.2) and long menu labels (PRD FR-WEB-02) live in messages/*.json under `dayStatus`. */

/** Pill colours: work neutral, vacation/sick coral, holiday blue-gray. */
export const DAY_STATUS_PILL: Record<EntryType, string> = {
  work: "bg-muted text-foreground",
  vacation: "bg-pto-subtle text-pto",
  sick: "bg-pto-subtle text-pto",
  holiday: "bg-holiday-subtle text-holiday",
};

/** Whole-column tint for a PTO day. */
export const DAY_STATUS_COLUMN: Record<EntryType, string> = {
  work: "",
  vacation: "bg-pto-subtle",
  sick: "bg-pto-subtle",
  holiday: "bg-holiday-subtle",
};
