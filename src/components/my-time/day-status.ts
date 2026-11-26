import type { EntryType } from "@/contracts";

/** Short pill labels (docs/05 §6.2) and long menu labels (PRD FR-WEB-02). */
export const DAY_STATUS_SHORT: Record<EntryType, string> = {
  work: "Work",
  vacation: "Vac",
  sick: "Sick",
  holiday: "Hol",
};

export const DAY_STATUS_LONG: Record<EntryType, string> = {
  work: "Work",
  vacation: "Vacation",
  sick: "Sick day",
  holiday: "Public holiday",
};

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
