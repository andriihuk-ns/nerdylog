"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { roleSchema, type AppSettings, type DirectoryUser } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { syncDirectoryFromSlack, updateDirectoryUser } from "@/server/services/directory-service";
import { getAppSettings, updateAppSettings } from "@/server/services/settings-service";
import { fetchSlackDirectory } from "@/server/slack/directory";
import { actionError, fail, ok, type ActionResult } from "../action-result";
import { channelFailure, channelFieldError, type ChannelActionResult } from "./channel-result";
import { channelIdSchema, ensureBotInChannel, serverCopy } from "./channel-guard";

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

/** Refresh only people when the admin directory opens; project channel membership has its own action. */
export async function syncPeopleFromSlackAction(): Promise<ActionResult<{ created: number; updated: number }>> {
  try {
    const actor = await requireActor(ADMIN);
    const members = await fetchSlackDirectory();
    const people = await syncDirectoryFromSlack(actor, members);
    refresh();
    return ok(people);
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
