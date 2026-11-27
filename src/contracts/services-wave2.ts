import type { EntryType, Role } from "./enums";
import type { Locale } from "./locale";
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
/** A15 people page: one user's check-ins in [from, to]; manager/admin any user, member only self. */
export type ListCheckinsForUser = (actor: Actor, userId: string, from: IsoDate, to: IsoDate) => Promise<CheckinView[]>;
/** manager/admin: all active users' check-ins for the date; member: only own. */
export type ListCheckinsForDate = (actor: Actor, date: IsoDate) => Promise<CheckinView[]>;

// ── src/server/services/directory-service.ts (admin) ─────────────────────────
export interface DirectoryUser {
  id: string;
  slackUserId: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  title: string | null; // A12
  role: Role;
  timezone: string;
  dailyNormHours: number;
  ptoAllowanceDays: number | null;
  sickAllowanceDays: number | null;
  isActive: boolean;
  officeId: string | null; // A15
  projectIds: string[]; // A15: projects whose Slack channel the person is in
}
export type ListDirectory = (actor: Actor) => Promise<DirectoryUser[]>; // manager+ read
export type UpdateDirectoryUser = (
  actor: Actor, // admin only
  userId: string,
  patch: Partial<Pick<DirectoryUser, "role" | "dailyNormHours" | "ptoAllowanceDays" | "sickAllowanceDays" | "isActive" | "timezone" | "officeId">>,
) => Promise<DirectoryUser>;
/** One member of Slack users.list, already filtered (no bots, no deleted, no Slackbot) by the Slack layer. */
export interface SlackDirectoryMember {
  slackUserId: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  title: string | null; // A12: profile.title; blank → null
}
/** src/server/slack/directory.ts — paginated users.list, no arguments. */
export type FetchSlackDirectory = () => Promise<SlackDirectoryMember[]>;
/** admin only. Upserts by slack_user_id; never changes role, norms, allowances, or active state; new rows → member, active. */
export type SyncDirectoryFromSlack = (
  actor: Actor,
  members: SlackDirectoryMember[],
) => Promise<{ created: number; updated: number }>;

// ── src/server/services/project-service.ts ───────────────────────────────────
export interface ProjectView {
  id: string;
  name: string;
  isActive: boolean;
  slackChannelId: string | null; // A11: one channel = one project; unique. Required for new projects (A15).
  createdBy: { userId: string; fullName: string } | null; // A15
  memberIds: string[]; // A15: Tempo users in the project's Slack channel (cached)
  memberAllocations: ProjectMemberAllocation[]; // A26: monthly allocation for each current member
  isMember: boolean; // A15: whether the calling actor is a member
  statusPromptTime: string; // A16: "HH:MM" in the prompt office's timezone, default "10:00"
  statusPromptOfficeId: string | null; // A16: office whose timezone + holidays apply (null → UA)
  statusPromptTimezone: string | null; // A29: IANA zone of the prompt time; null → the office zone
  hasTimeEntries: boolean; // A16: delete allowed only when false
}
export interface ProjectMemberAllocation {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  allocationHoursPerMonth: number;
}
/** Everyone sees all projects (A15); isMember tells the UI whether to show "Ask {creator}". */
export type ListProjects = (actor: Actor, opts?: { includeArchived?: boolean }) => Promise<ProjectView[]>;
export interface UpsertProjectInput {
  id?: string;
  name: string;
  slackChannelId: string | null; // required when creating
  isActive?: boolean;
  statusPromptTime?: string; // A16 "HH:MM" (00:00–23:59), default "10:00"
  statusPromptOfficeId?: string | null; // A16
  statusPromptTimezone?: string | null; // A29
}
/** A16 admin: delete a project with no time entries; otherwise InvalidInputError { _: ["has_entries"] } (archive instead). */
export type DeleteProject = (actor: Actor, id: string) => Promise<void>;
/** admin. Sets created_by on create. Caller refreshes members afterwards (ReplaceProjectMembers). */
export type UpsertProject = (actor: Actor, input: UpsertProjectInput) => Promise<ProjectView>;
/**
 * A15 system call (no actor; callers check admin first): replace the cached members of a project with
 * the Tempo users whose slack_user_id is in `memberSlackIds` (unknown ids skipped and counted).
 */
export type ReplaceProjectMembers = (projectId: string, memberSlackIds: string[]) => Promise<{ members: number; skipped: number }>;
/** Admin only. Monthly allocation in hours for one current project member. */
export type UpdateProjectMemberAllocation = (actor: Actor, projectId: string, userId: string, hoursPerMonth: number) => Promise<ProjectMemberAllocation>;
/**
 * A15 access rule used by time-entry-service and standup-service: logging work to a project the user is
 * not a member of throws InvalidInputError with fieldErrors { projectId: ["not_member"] } (UI shows
 * "Ask {creator} to add you to #channel").
 */
export type AssertProjectMember = (userId: string, projectId: string) => Promise<void>;
/** src/server/slack/channels.ts — paginated conversations.members; bot must be in the channel. */
export type FetchChannelMemberSlackIds = (channelId: string) => Promise<string[]>;

// ── src/server/services/holiday-service.ts ───────────────────────────────────
export interface HolidayView {
  id: string;
  officeId: string; // A15
  holidayDate: IsoDate;
  name: string;
}
/** officeId omitted → all offices. */
export type ListHolidays = (actor: Actor, year: number, officeId?: string) => Promise<HolidayView[]>;
export type AddHoliday = (actor: Actor, input: Omit<HolidayView, "id">) => Promise<HolidayView>; // admin
export type RemoveHoliday = (actor: Actor, id: string) => Promise<void>; // admin
/** A15 admin: copy an office's holidays from one year to another (same month/day); existing dates skipped. */
export type CopyHolidays = (actor: Actor, officeId: string, fromYear: number, toYear: number) => Promise<{ copied: number; skipped: number }>;

// ── src/server/services/office-service.ts (A15) ──────────────────────────────
export interface OfficeView {
  id: string;
  code: string; // "UA", "PL"
  name: string;
  timezone: string; // A16 IANA, e.g. "Europe/Kyiv"
  memberCount: number;
}
export type ListOffices = (actor: Actor) => Promise<OfficeView[]>; // any signed-in user
export type UpsertOffice = (actor: Actor, input: { id?: string; code: string; name: string; timezone: string }) => Promise<OfficeView>; // admin
/** admin. Only when the office has no members and no holidays; otherwise InvalidInputError. */
export type DeleteOffice = (actor: Actor, id: string) => Promise<void>;
/** A30 admin: office ids in display order (offices tab, holiday tabs, office selects). */
export type ReorderOffices = (actor: Actor, ids: string[]) => Promise<void>;


// ── A16: per-project status prompt in the project channel ───────────────────
export interface ProjectPromptTarget {
  projectId: string;
  projectName: string;
  slackChannelId: string;
  localDate: IsoDate; // in the prompt office's timezone
  logDate: IsoDate; // previous business day for that office (default date in the modal)
  recipients: Array<{ slackUserId: string; locale: Locale }>; // A31/A32: active members, each in their web locale
}
/**
 * src/server/services/project-prompt-service.ts (system, cron). Active projects with a channel whose
 * office-local time is in [statusPromptTime, +90 min) on a weekday that is not that office's holiday;
 * inserts project_prompts (ON CONFLICT DO NOTHING) and returns only newly claimed projects.
 */
export type ClaimProjectPrompts = (now: Date) => Promise<ProjectPromptTarget[]>;

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
export type BuildSummaryCsv = (actor: Actor, month: string, projectIds?: string[]) => Promise<ExportFile>;
export type BuildReportPdf = (actor: Actor, range: ExportRange) => Promise<ExportFile>;

// ── src/server/services/settings-service.ts (A11) ───────────────────────────
export interface AppSettings {
  standupChannelId: string | null; // general channel for full standup cards
}
export type GetAppSettings = (actor: Actor) => Promise<AppSettings>; // manager+ read
export type UpdateAppSettings = (actor: Actor, patch: Partial<AppSettings>) => Promise<AppSettings>; // admin
/** System read for the Slack layer (no actor). */
export type GetStandupChannelId = () => Promise<string | null>;
/** System read for the Slack layer: active projects that have a channel. */
export type ListProjectChannels = () => Promise<Array<{ projectId: string; projectName: string; slackChannelId: string }>>;

// ── src/server/slack/channels.ts (A11) ───────────────────────────────────────
export interface SlackChannelOption {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean; // bot already in the channel
}
/** Non-archived public + private channels visible to the bot (paginated conversations.list). */
export type ListSlackChannels = () => Promise<SlackChannelOption[]>;
export type JoinSlackChannelResult =
  | { ok: true }
  | { ok: false; reason: "private_needs_invite" | "not_found" | "error"; message: string };
/** Public channel → conversations.join; private and not a member → private_needs_invite. */
export type JoinSlackChannel = (channelId: string) => Promise<JoinSlackChannelResult>;
