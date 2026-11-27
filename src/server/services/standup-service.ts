import type { SubmitSlackSubmission } from "@/contracts";
import { getDb } from "@/server/db/client";
import type { Tx } from "@/server/db/queries/types";
import {
  dailyCheckins,
  slackSubmissions,
  timeEntries,
  type DailyCheckinInsert,
  type TimeEntryInsert,
} from "@/server/db/schema";
import { isUniqueViolation } from "./pg-errors";
import { assertProjectMember } from "./project-service";
import { prepareSubmission } from "./standup-rows";

/** Default Postgres name of the slack_submissions primary key (drizzle/0000_init.sql). */
export const SLACK_SUBMISSIONS_PKEY = "slack_submissions_pkey";

/** Stream A: tracked time. Returns the new entry ids in input order. */
async function insertTimeEntries(tx: Tx, rows: TimeEntryInsert[]): Promise<string[]> {
  if (rows.length === 0) return [];
  const inserted = await tx.insert(timeEntries).values(rows).returning({ id: timeEntries.id });
  return inserted.map((r) => r.id);
}

/**
 * Stream B: reference-only standup context. Touches `daily_checkins` only, never
 * `time_entries`. One check-in per user per day: a second submission updates the text.
 */
async function upsertDailyCheckin(tx: Tx, row: DailyCheckinInsert): Promise<void> {
  await tx
    .insert(dailyCheckins)
    .values(row)
    .onConflictDoUpdate({
      target: [dailyCheckins.userId, dailyCheckins.checkinDate],
      set: { plannedToday: row.plannedToday, blockers: row.blockers },
    });
}

/**
 * Contract SubmitSlackSubmission (amendment A1). Validation runs before any write and
 * throws InvalidSubmissionError; A15: a work row for a project the user is not a member of throws
 * InvalidInputError { projectId: ["not_member"] } (AssertProjectMember), also before any write. Then ONE transaction: ledger row → time entries →
 * check-in upsert. A repeated `view_id` fails the first insert with SQLSTATE 23505,
 * rolls everything back and returns `{ status: "duplicate" }`. Other errors propagate.
 */
export const submitSlackSubmission: SubmitSlackSubmission = async (input) => {
  const prepared = prepareSubmission(input);
  const pairs = new Map<string, { userId: string; projectId: string }>();
  for (const e of prepared.entries) {
    if (e.entryType === "work" && e.projectId) pairs.set(`${e.userId}:${e.projectId}`, { userId: e.userId, projectId: e.projectId });
  }
  for (const { userId, projectId } of pairs.values()) await assertProjectMember(userId, projectId);
  try {
    const entryIds = await getDb().transaction(async (tx) => {
      await tx.insert(slackSubmissions).values(prepared.submission);
      const ids = await insertTimeEntries(tx, prepared.entries);
      if (prepared.checkin) await upsertDailyCheckin(tx, prepared.checkin);
      return ids;
    });
    return { status: "created", entryIds };
  } catch (error) {
    if (isUniqueViolation(error, SLACK_SUBMISSIONS_PKEY)) return { status: "duplicate" };
    throw error;
  }
};
