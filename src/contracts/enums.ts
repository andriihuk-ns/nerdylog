import { z } from "zod";

/** Shared enums. Drizzle pgEnums in src/server/db must use these exact value lists. */
export const ROLES = ["admin", "manager", "member"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ENTRY_TYPES = ["work", "vacation", "sick", "holiday"] as const;
export const entryTypeSchema = z.enum(ENTRY_TYPES);
export type EntryType = z.infer<typeof entryTypeSchema>;

export const ENTRY_SOURCES = ["slack_standup", "slack_command", "web_ui", "sheet_import"] as const;
export const entrySourceSchema = z.enum(ENTRY_SOURCES);
export type EntrySource = z.infer<typeof entrySourceSchema>;

export const SLACK_SUBMISSION_KINDS = ["standup", "log", "pto"] as const;
export const slackSubmissionKindSchema = z.enum(SLACK_SUBMISSION_KINDS);
export type SlackSubmissionKind = z.infer<typeof slackSubmissionKindSchema>;
