import type { SlackSubmissionKind } from "./enums";
import type { UserMonthRollup, ProjectCapUsage } from "./rollup";
import type { DailyCheckinInput, IsoDate, TimeEntryInput } from "./time";
import type { Actor, SlackIdentity } from "./users";

/**
 * Cross-agent service signatures. Backend implements them in src/server/services/**;
 * Slack, auth and UI call them. Changing a signature is an Orchestrator decision.
 */

/** src/server/services/user-service.ts — throws InactiveUserError for archived users (callers: deny sign-in). */
export type UpsertUserFromSlack = (identity: SlackIdentity) => Promise<Actor>;
export type GetActorByAuthUserId = (authUserId: string) => Promise<Actor | null>;

/**
 * src/server/services/standup-service.ts — amendment A1, one transaction.
 * Throws InvalidSubmissionError before writing anything (callers: show modal field errors).
 * "duplicate" means a Slack retry: ack 200 and do nothing.
 */
export interface SlackSubmissionInput {
  viewId: string;
  userId: string;
  kind: SlackSubmissionKind;
  entries: TimeEntryInput[]; // Stream A; ticket refs are extracted by the service
  checkin: DailyCheckinInput | null; // Stream B; never touches time_entries
}
export type SubmitSlackSubmissionResult = { status: "created"; entryIds: string[] } | { status: "duplicate" };
export type SubmitSlackSubmission = (input: SlackSubmissionInput) => Promise<SubmitSlackSubmissionResult>;

/** src/server/services/calendar.ts — pure helpers, no DB. */
export type PreviousBusinessDay = (date: IsoDate, holidays: ReadonlySet<IsoDate>) => IsoDate;

/** src/server/services/rollup-service.ts — wraps the pure math in time-aggregator.ts. */
export type GetTeamMonthRollup = (actor: Actor, month: string) => Promise<UserMonthRollup[]>;
export type GetProjectCapUsage = (actor: Actor, month: string) => Promise<ProjectCapUsage[]>;

/**
 * src/server/services/pto-service.ts — amendment A9. Members may only read their own balance.
 * Throws ForbiddenError / NotFoundError (src/server/services/errors.ts) and RangeError for a bad year.
 * Callers derive `year` from the user's timezone.
 */
export interface PtoBalance {
  userId: string;
  year: number;
  allowanceDays: number | null; // null → allowance not set
  vacationUsedDays: number; // distinct vacation dates in the calendar year
  sickUsedDays: number; // informational; never reduces the allowance
  remainingDays: number | null; // null when allowance is null; may be negative
}
export type GetPtoBalance = (actor: Actor, userId: string, year: number) => Promise<PtoBalance>;
