import { z } from "zod";
import {
  dailyCheckinInputSchema,
  extractTicketRefs,
  slackSubmissionKindSchema,
  timeEntryInputSchema,
  type SlackSubmissionInput,
} from "@/contracts";
import type { DailyCheckinInsert, SlackSubmissionInsert, TimeEntryInsert } from "@/server/db/schema";

/** Thrown before any DB write when a Slack submission is malformed. */
export class InvalidSubmissionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InvalidSubmissionError";
  }
}

export interface PreparedSubmission {
  submission: SlackSubmissionInsert;
  /** Stream A rows. */
  entries: TimeEntryInsert[];
  /** Stream B row; never mixed into `entries`. */
  checkin: DailyCheckinInsert | null;
}

const headerSchema = z.object({
  viewId: z.string().min(1),
  userId: z.uuid(),
  kind: slackSubmissionKindSchema,
});

function parse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvalidSubmissionError(`${label}: ${z.prettifyError(result.error)}`, { cause: result.error });
  }
  return result.data;
}

/**
 * Pure validation and mapping for SubmitSlackSubmission (amendment A1).
 * Every entry and the check-in must belong to the submitting user; ticket refs are
 * extracted from task summaries; every entry is stamped with the view id.
 */
export function prepareSubmission(input: SlackSubmissionInput): PreparedSubmission {
  const header = parse(headerSchema, input, "submission");

  const entries = input.entries.map((raw, i) => {
    const e = parse(timeEntryInputSchema, raw, `entries[${i}]`);
    if (e.userId !== header.userId) {
      throw new InvalidSubmissionError(`entries[${i}]: userId does not match the submitting user`);
    }
    return {
      userId: e.userId,
      projectId: e.projectId,
      workDate: e.workDate,
      hours: e.hours,
      entryType: e.entryType,
      taskSummary: e.taskSummary,
      ticketRefs: extractTicketRefs(e.taskSummary),
      source: e.source,
      slackViewId: header.viewId,
    } satisfies TimeEntryInsert;
  });

  let checkin: DailyCheckinInsert | null = null;
  if (input.checkin) {
    const c = parse(dailyCheckinInputSchema, input.checkin, "checkin");
    if (c.userId !== header.userId) {
      throw new InvalidSubmissionError("checkin: userId does not match the submitting user");
    }
    checkin = { userId: c.userId, checkinDate: c.checkinDate, plannedToday: c.plannedToday, blockers: c.blockers };
  }

  return { submission: header, entries, checkin };
}
