"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isoDateSchema, roleSchema, type DirectoryUser, type HolidayView, type ProjectView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import { syncDirectoryFromSlack, updateDirectoryUser } from "@/server/services/directory-service";
import { upsertProject } from "@/server/services/project-service";
import { addHoliday, removeHoliday } from "@/server/services/holiday-service";
import { fetchSlackDirectory } from "@/server/slack/directory";
import { actionError, ok, type ActionResult } from "../action-result";

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

export async function syncFromSlackAction(): Promise<ActionResult<{ created: number; updated: number }>> {
  try {
    const actor = await requireActor(ADMIN);
    const members = await fetchSlackDirectory();
    const result: { created: number; updated: number } = await syncDirectoryFromSlack(actor, members);
    refresh();
    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}

const projectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z.string().trim().max(32).nullable(),
  monthlyHourCap: z.number().positive().max(10000).nullable(),
  isBillable: z.boolean(),
  isActive: z.boolean(),
});

export type ProjectInput = z.input<typeof projectSchema>;

export async function upsertProjectAction(input: ProjectInput): Promise<ActionResult<ProjectView>> {
  try {
    const actor = await requireActor(ADMIN);
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the project fields." };
    const project: ProjectView = await upsertProject(actor, { ...parsed.data, code: parsed.data.code || null });
    refresh();
    return ok(project);
  } catch (err) {
    return actionError(err);
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
