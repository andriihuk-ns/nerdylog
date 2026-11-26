import type { EntryType, Role } from "./enums";
import type { DailyCheckinInput, IsoDate, TimeEntryInput } from "./time";
import type { Actor } from "./users";

/**
 * Wave 2 service signatures. Backend implements; Slack and Frontend call.
 * All functions enforce RBAC (amendment A5) and throw ForbiddenError / NotFoundError
 * from src/server/services/errors.ts. Zod-invalid input throws InvalidInputError (same module).
 */

// ── src/server/services/time-entry-service.ts (web_ui source) ────────────────
export interface TimeEntryView {
  id: string;
  userId: string;
  projectId: string | null;
  projectName: string | null;
  workDate: IsoDate;
  hours: number;
  entryType: EntryType;
  taskSummary: string;
  ticketRefs: string[];
  source: TimeEntryInput["source"];
}
/** Entries for userId in [weekStart, weekStart+6]. weekStart must be a Monday. */
export type ListWeekEntries = (actor: Actor, userId: string, weekStart: IsoDate) => Promise<TimeEntryView[]>;
export type CreateTimeEntry = (actor: Actor, input: Omit<TimeEntryInput, "source" | "slackViewId">) => Promise<TimeEntryView>;
export type UpdateTimeEntry = (
  actor: Actor,
  id: string,
  patch: Partial<Pick<TimeEntryInput, "projectId" | "hours" | "taskSummary">>,
) => Promise<TimeEntryView>;
export type DeleteTimeEntry = (actor: Actor, id: string) => Promise<void>;
/**
 * FR-WEB-02 day-status pill. "work" removes PTO rows for that date;
 * vacation/sick/holiday deletes that day's work rows and writes one 0h PTO row.
 */
export type SetDayStatus = (actor: Actor, userId: string, date: IsoDate, status: EntryType) => Promise<TimeEntryView[]>;

// ── src/server/services/checkin-service.ts (Stream B, read-only views) ───────
export interface CheckinView extends DailyCheckinInput {
  fullName: string;
  avatarUrl: string | null;
  hasBlocker: boolean;
}
/** System call after the channel broadcast (no actor; Slack layer only). */
export type SetCheckinChannelTs = (userId: string, checkinDate: IsoDate, ts: string) => Promise<void>;
/** manager/admin: all active users' check-ins for the date; member: only own. */
/** System call after the channel broadcast (no actor; Slack layer only). */
export type SetCheckinChannelTs = (userId: string, checkinDate: IsoDate, ts: string) => Promise<void>;
export type ListCheckinsForDate = (actor: Actor, date: IsoDate) => Promise<CheckinView[]>;

// ── src/server/services/directory-service.ts (admin) ─────────────────────────
export interface DirectoryUser {
  id: string;
  slackUserId: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
  timezone: string;
  dailyNormHours: number;
  ptoAllowanceDays: number | null;
  isActive: boolean;
}
export type ListDirectory = (actor: Actor) => Promise<DirectoryUser[]>; // manager+ read
export type UpdateDirectoryUser = (
  actor: Actor, // admin only
  userId: string,
  patch: Partial<Pick<DirectoryUser, "role" | "dailyNormHours" | "ptoAllowanceDays" | "isActive" | "timezone">>,
) => Promise<DirectoryUser>;
/** One member of Slack users.list, already filtered (no bots, no deleted, no Slackbot) by the Slack layer. */
export interface SlackDirectoryMember {
  slackUserId: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  timezone: string | null;
}
/** admin only. Upserts by slack_user_id; never changes role/norm/allowance; new rows → member, active. */
export type SyncDirectoryFromSlack = (
  actor: Actor,
  members: SlackDirectoryMember[],
) => Promise<{ created: number; updated: number }>;

// ── src/server/services/project-service.ts ───────────────────────────────────
export interface ProjectView {
  id: string;
  name: string;
  code: string | null;
  monthlyHourCap: number | null;
  isBillable: boolean;
  isActive: boolean;
}
export type ListProjects = (actor: Actor, opts?: { includeArchived?: boolean }) => Promise<ProjectView[]>;
export type UpsertProject = (actor: Actor, input: Omit<ProjectView, "id"> & { id?: string }) => Promise<ProjectView>; // admin

// ── src/server/services/holiday-service.ts ───────────────────────────────────
export interface HolidayView {
  id: string;
  holidayDate: IsoDate;
  name: string;
}
export type ListHolidays = (actor: Actor, year: number) => Promise<HolidayView[]>;
export type AddHoliday = (actor: Actor, input: Omit<HolidayView, "id">) => Promise<HolidayView>; // admin
export type RemoveHoliday = (actor: Actor, id: string) => Promise<void>; // admin

// ── src/server/services/ping-service.ts (system, no actor; cron only) ────────
export interface PingTarget {
  userId: string;
  slackUserId: string;
  fullName: string;
  timezone: string;
  localDate: IsoDate; // today in the user's timezone
  logDate: IsoDate; // previousBusinessDay(localDate)
}
/**
 * Amendment A4. Returns active users whose local time is in [09:30, 09:45) on a weekday,
 * not a company holiday, not on PTO that day, and inserts their daily_pings row
 * (ON CONFLICT DO NOTHING) — only users newly claimed are returned.
 */
export type ClaimMorningPings = (now: Date) => Promise<PingTarget[]>;

// ── src/server/services/export-service.ts ────────────────────────────────────
export interface ExportRange {
  from: IsoDate;
  to: IsoDate;
  userIds?: string[]; // omitted → self for members, all active for manager+
  projectIds?: string[];
}
export interface ExportFile {
  filename: string;
  contentType: string;
  body: Uint8Array;
}
export type BuildLedgerCsv = (actor: Actor, range: ExportRange) => Promise<ExportFile>;
export type BuildSummaryCsv = (actor: Actor, month: string) => Promise<ExportFile>;
export type BuildReportPdf = (actor: Actor, range: ExportRange) => Promise<ExportFile>;
