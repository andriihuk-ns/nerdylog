"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  isoDateSchema,
  roleSchema,
  type AppSettings,
  type DirectoryUser,
  type HolidayView,
  type JoinSlackChannelResult,
  type ProjectView,
  type SlackUsergroup,
  type TeamView,
} from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { syncDirectoryFromSlack, updateDirectoryUser } from "@/server/services/directory-service";
import { listProjects, upsertProject } from "@/server/services/project-service";
import { addHoliday, removeHoliday } from "@/server/services/holiday-service";
import { getAppSettings, updateAppSettings } from "@/server/services/settings-service";
import { SLACK_CHANNEL_ID_PATTERN } from "@/server/services/validation";
import { fetchSlackDirectory } from "@/server/slack/directory";
import { joinSlackChannel } from "@/server/slack/channels";
import { fetchSlackUsergroups } from "@/server/slack/usergroups";
import { listTeams, syncTeamsFromSlack, updateTeamChannel } from "@/server/services/team-service";
import { actionError, ok, type ActionResult } from "../action-result";
import { channelFailure, channelFieldError, fromJoinResult, type ChannelActionResult, type ChannelFailure } from "./channel-result";
import { teamsErrorText, type SlackSyncResult, type TeamSyncCounts } from "./sync-result";

const ADMIN = ["admin"] as const;

const directoryPatchSchema = z
  .object({
    role: roleSchema,
    dailyNormHours: z.number().min(0.25).max(24).multipleOf(0.25),
    ptoAllowanceDays: z.number().min(0).max(366).multipleOf(0.5).nullable(),
    isActive: z.boolean(),
  })
  .partial();

export type DirectoryPatch = z.input<typeof directoryPatchSchema>;

export async function updateDirectoryUserAction(userId: string, patch: DirectoryPatch): Promise<ActionResult<DirectoryUser>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = directoryPatchSchema.safeParse(patch);
    if (!parsed.success || !z.uuid().safeParse(userId).success) {
      return { ok: false, message: "Daily norm must be 0.25–24h; allowance 0–366 days in half days." };
    }
    const user: DirectoryUser = await updateDirectoryUser(actor, userId, parsed.data);
    refresh();
    return ok(user);
  } catch (err) {
    return actionError(err);
  }
}

/** A13: directory first (its result always stands), then user groups → teams. */
export async function syncFromSlackAction(): Promise<ActionResult<SlackSyncResult>> {
  try {
    const actor = await requireActor(ADMIN);
    const members = await fetchSlackDirectory();
    const people: { created: number; updated: number } = await syncDirectoryFromSlack(actor, members);
    let teams: TeamSyncCounts | null = null;
    let teamsError: string | null = null;
    try {
      const groups: SlackUsergroup[] = await fetchSlackUsergroups();
      teams = await syncTeamsFromSlack(actor, groups);
    } catch (err) {
      console.warn("team sync failed", err instanceof Error ? err.message : err);
      teamsError = teamsErrorText(err);
    }
    refresh();
    return ok({ people, teams, teamsError });
  } catch (err) {
    return actionError(err);
  }
}

const channelIdSchema = z.string().regex(SLACK_CHANNEL_ID_PATTERN, "Not a valid Slack channel").nullable();

/** A11: make sure the bot is in the channel before saving it. Slack not configured → inline error. */
async function ensureBotInChannel(channelId: string): Promise<ChannelFailure | null> {
  let result: JoinSlackChannelResult;
  try {
    result = await joinSlackChannel(channelId);
  } catch {
    return channelFailure("Connect the Slack app to choose channels.", "error");
  }
  return fromJoinResult(result);
}

const projectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z.string().trim().max(32).nullable(),
  monthlyHourCap: z.number().positive().max(10000).nullable(),
  isBillable: z.boolean(),
  isActive: z.boolean(),
  slackChannelId: channelIdSchema,
});

export type ProjectInput = z.input<typeof projectSchema>;

export async function upsertProjectAction(input: ProjectInput): Promise<ChannelActionResult<ProjectView>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === "slackChannelId") return channelFailure(issue.message);
      return { ok: false, message: issue?.message ?? "Check the project fields." };
    }
    const { slackChannelId } = parsed.data;
    if (slackChannelId) {
      const projects: ProjectView[] = await listProjects(actor, { includeArchived: true });
      const owner = projects.find((p) => p.slackChannelId === slackChannelId && p.id !== parsed.data.id);
      if (owner) return channelFailure(`Already linked to ${owner.name}`);
      const current = projects.find((p) => p.id === parsed.data.id);
      if (current?.slackChannelId !== slackChannelId) {
        const failure = await ensureBotInChannel(slackChannelId);
        if (failure) return failure;
      }
    }
    const project: ProjectView = await upsertProject(actor, { ...parsed.data, code: parsed.data.code || null });
    refresh();
    return ok(project);
  } catch (err) {
    return channelFieldError(err) ?? actionError(err);
  }
}

/** A11 Settings tab: the general standup channel (null → Off). Joins the channel first when it changes. */
export async function updateStandupChannelAction(channelId: string | null): Promise<ChannelActionResult<AppSettings>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = channelIdSchema.safeParse(channelId);
    if (!parsed.success) return channelFailure("Not a valid Slack channel");
    const current: AppSettings = await getAppSettings(actor);
    if (parsed.data && parsed.data !== current.standupChannelId) {
      const failure = await ensureBotInChannel(parsed.data);
      if (failure) return failure;
    }
    const settings: AppSettings = await updateAppSettings(actor, { standupChannelId: parsed.data });
    refresh();
    return ok(settings);
  } catch (err) {
    return channelFieldError(err) ?? actionError(err);
  }
}

/** A13 Teams tab: one channel per team (null → none). Same uniqueness + join-first rules as A11. */
export async function updateTeamChannelAction(teamId: string, channelId: string | null): Promise<ChannelActionResult<TeamView>> {
  try {
    const actor = await requireActor(ADMIN);
    if (!z.uuid().safeParse(teamId).success) return { ok: false, message: "Unknown team." };
    const parsed = channelIdSchema.safeParse(channelId);
    if (!parsed.success) return channelFailure("Not a valid Slack channel");
    if (parsed.data) {
      const teams: TeamView[] = await listTeams(actor, { includeArchived: true });
      const owner = teams.find((t) => t.slackChannelId === parsed.data && t.id !== teamId);
      if (owner) return channelFailure(`Already linked to @${owner.handle}`);
      const current = teams.find((t) => t.id === teamId);
      if (current?.slackChannelId !== parsed.data) {
        const failure = await ensureBotInChannel(parsed.data);
        if (failure) return failure;
      }
    }
    const team: TeamView = await updateTeamChannel(actor, teamId, parsed.data);
    refresh();
    return ok(team);
  } catch (err) {
    return channelFieldError(err) ?? actionError(err);
  }
}

const holidaySchema = z.object({
  holidayDate: isoDateSchema,
  name: z.string().trim().min(1, "Name is required").max(120),
});

export async function addHolidayAction(input: z.input<typeof holidaySchema>): Promise<ActionResult<HolidayView>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = holidaySchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the holiday fields." };
    const holiday: HolidayView = await addHoliday(actor, parsed.data);
    refresh();
    return ok(holiday);
  } catch (err) {
    return actionError(err);
  }
}

export async function removeHolidayAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(ADMIN);
    if (!z.uuid().safeParse(id).success) return { ok: false, message: "Unknown holiday." };
    await removeHoliday(actor, id);
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}
