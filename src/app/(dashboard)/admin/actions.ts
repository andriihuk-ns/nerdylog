"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { roleSchema, type AppSettings, type DirectoryUser, type ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { syncDirectoryFromSlack, updateDirectoryUser } from "@/server/services/directory-service";
import { listProjects } from "@/server/services/project-service";
import { getAppSettings, updateAppSettings } from "@/server/services/settings-service";
import { fetchSlackDirectory } from "@/server/slack/directory";
import { actionError, fail, ok, type ActionResult } from "../action-result";
import { channelFailure, channelFieldError, type ChannelActionResult } from "./channel-result";
import { channelIdSchema, ensureBotInChannel, serverCopy } from "./channel-guard";
import { refreshAllMembers } from "./project-members";
import type { SlackSyncResult } from "./sync-result";

const ADMIN = ["admin"] as const;

const directoryPatchSchema = z
  .object({
    role: roleSchema,
    dailyNormHours: z.number().min(0.25).max(24).multipleOf(0.25),
    ptoAllowanceDays: z.number().min(0).max(366).multipleOf(0.5).nullable(),
    isActive: z.boolean(),
    officeId: z.uuid().nullable(), // A15
  })
  .partial();

export type DirectoryPatch = z.input<typeof directoryPatchSchema>;

export async function updateDirectoryUserAction(userId: string, patch: DirectoryPatch): Promise<ActionResult<DirectoryUser>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = directoryPatchSchema.safeParse(patch);
    if (!parsed.success || !z.uuid().safeParse(userId).success) {
      return fail((await serverCopy())("directoryInvalid"));
    }
    const user: DirectoryUser = await updateDirectoryUser(actor, userId, parsed.data);
    refresh();
    return ok(user);
  } catch (err) {
    return actionError(err);
  }
}

/** A15: directory first (its result always stands), then members of every project with a channel. */
export async function syncFromSlackAction(): Promise<ActionResult<SlackSyncResult>> {
  try {
    const actor = await requireActor(ADMIN);
    const members = await fetchSlackDirectory();
    const people: { created: number; updated: number } = await syncDirectoryFromSlack(actor, members);
    const projects: ProjectView[] = await listProjects(actor, { includeArchived: true });
    const refreshed = await refreshAllMembers(projects);
    refresh();
    return ok({ people, projects: refreshed });
  } catch (err) {
    return actionError(err);
  }
}

/** A11 Settings tab: the general standup channel (null → Off). Joins the channel first when it changes. */
export async function updateStandupChannelAction(channelId: string | null): Promise<ChannelActionResult<AppSettings>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = channelIdSchema.safeParse(channelId);
    if (!parsed.success) return channelFailure((await serverCopy())("invalidChannel"));
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
