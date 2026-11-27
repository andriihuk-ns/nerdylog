import { z } from "zod";
import { entrySourceSchema, entryTypeSchema } from "./enums";

/** ISO calendar date, e.g. "2026-11-26". All work/checkin dates use this shape. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export type IsoDate = z.infer<typeof isoDateSchema>;

/** Ticket references like DOG-1364 or CNG-009 (PRD FR-SLACK-02). */
export const TICKET_REF_REGEX = /\b[A-Z][A-Z0-9]*-\d+\b/g;
export const MAX_TASK_SUMMARY_LENGTH = 10_000;

export function extractTicketRefs(text: string): string[] {
  return [...new Set(text.match(TICKET_REF_REGEX) ?? [])];
}

/** Stream A input: one time entry row. PTO rows have no project and hours = 0. */
export const timeEntryInputSchema = z
  .object({
    userId: z.uuid(),
    projectId: z.uuid().nullable(),
    workDate: isoDateSchema,
    hours: z.number().min(0).max(24).multipleOf(0.25),
    entryType: entryTypeSchema,
    taskSummary: z.string().max(MAX_TASK_SUMMARY_LENGTH).default(""),
    source: entrySourceSchema,
    slackViewId: z.string().nullable().default(null),
  })
  .refine((e) => e.entryType !== "work" || e.projectId !== null, {
    message: "Work entries need a project",
    path: ["projectId"],
  })
  .refine((e) => e.entryType === "work" || e.hours === 0, {
    message: "PTO entries carry 0 work hours",
    path: ["hours"],
  });
export type TimeEntryInput = z.infer<typeof timeEntryInputSchema>;

/** Stream B input: reference-only standup context. Never feeds hour totals. */
export const dailyCheckinInputSchema = z.object({
  userId: z.uuid(),
  checkinDate: isoDateSchema,
  plannedToday: z.string().max(4000).default(""),
  blockers: z.string().max(4000).default(""),
});
export type DailyCheckinInput = z.infer<typeof dailyCheckinInputSchema>;
