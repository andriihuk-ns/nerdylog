"use server";

import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { entryTypeSchema, isoDateSchema, type Actor, type EntryType, type ProjectView, type TimeEntryView } from "@/contracts";
import { requireActor } from "@/server/auth/session";
import {
  createTimeEntry,
  deleteTimeEntry,
  listWeekEntries,
  setDayStatus,
  updateTimeEntry,
} from "@/server/services/time-entry-service";
import { listProjects } from "@/server/services/project-service";
import { mondayOf } from "@/components/lib/dates";
import { formatHours } from "@/components/lib/format";
import { actionError, fail, fieldErrorCode, ok, type ActionResult } from "../action-result";
import { loadChannelNames } from "../channel-names";
import { accessHint } from "./project-options";
import { planCellSave } from "./cell-plan";

const saveCellSchema = z.object({
  date: isoDateSchema,
  projectId: z.uuid(),
  hours: z.number().min(0).max(24).multipleOf(0.25),
  note: z.string().max(2000).optional(),
  userId: z.uuid().optional(), // people page: a manager/admin edits on the person's behalf (PRD §2, A16)
});

export type SaveCellInput = z.input<typeof saveCellSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Own data, or (manager/admin) another person's: people page, PRD §2 + A16. Services re-check. */
function targetUser(actor: Actor, userId: string | undefined): string | null {
  if (!userId || userId === actor.userId) return actor.userId;
  return actor.role === "admin" || actor.role === "manager" ? userId : null;
}

/** A15: service fieldErrors { projectId: ["not_member"] } → "Ask {creator} to add you to #channel". */
async function notMemberMessage(actor: Actor, projectId: string, self: boolean): Promise<string> {
  const projects: ProjectView[] = await listProjects(actor, { includeArchived: true });
  const project = projects.find((p) => p.id === projectId);
  const t = await getTranslations("myTime.access");
  if (!project) return t("notMemberUnknown");
  const names = await loadChannelNames(project.slackChannelId ? [project.slackChannelId] : []);
  const hint = await accessHint(self ? { kind: "self" } : { kind: "other", name: t("thisPerson") }, names);
  return hint(project);
}

/** Sets work hours for one project on one day (web_ui source): own cell, or an admin on someone's behalf. */
export async function saveCellAction(input: SaveCellInput): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    const t = await getTranslations("myTime.server");
    const parsed = saveCellSchema.safeParse(input);
    if (!parsed.success) return fail(t("invalidHours"));
    const { date, projectId, hours, note } = parsed.data;
    const userId = targetUser(actor, parsed.data.userId);
    if (!userId) return fail((await getTranslations("errors"))("forbidden"));

    try {
      return await saveCell(actor, userId, { date, projectId, hours, note });
    } catch (err) {
      if (fieldErrorCode(err, "projectId") === "not_member") return fail(await notMemberMessage(actor, projectId, userId === actor.userId));
      throw err;
    }
  } catch (err) {
    return actionError(err);
  }
}

async function saveCell(
  actor: Actor,
  userId: string,
  { date, projectId, hours, note }: { date: string; projectId: string; hours: number; note?: string },
): Promise<ActionResult> {
  const t = await getTranslations("myTime.server");
  const week: TimeEntryView[] = await listWeekEntries(actor, userId, mondayOf(date));
  const day = week.filter((e) => e.workDate === date);
  if (day.some((e) => e.entryType !== "work")) {
    return fail(t("dayOff"));
  }
  const inCell = day.filter((e) => e.projectId === projectId);
  const otherHours = round2(day.filter((e) => e.projectId !== projectId).reduce((s, e) => s + e.hours, 0));
  if (otherHours + hours > 24) return fail(t("dayMax"));

  const plan = planCellSave(inCell, hours, note);
  if (!plan.ok) {
    const locale = await getLocale();
    return fail(t("cellBelow", { count: plan.entryCount, hours: formatHours(plan.minHours, locale) }));
  }
  for (const op of plan.ops) {
    if (op.op === "create") {
      await createTimeEntry(actor, {
        userId,
        projectId,
        workDate: date,
        hours: op.hours,
        entryType: "work",
        taskSummary: op.taskSummary,
      });
    } else if (op.op === "update") {
      const patch = op.taskSummary === undefined ? { hours: op.hours } : { hours: op.hours, taskSummary: op.taskSummary };
      await updateTimeEntry(actor, op.id, patch);
    } else {
      await deleteTimeEntry(actor, op.id);
    }
  }
  refresh();
  return ok();
}

const dayStatusSchema = z.object({ date: isoDateSchema, status: entryTypeSchema, userId: z.uuid().optional() });

/** FR-WEB-02 day-status pill: own day, or (admin) another person's on the people page. */
export async function setDayStatusAction(input: { date: string; status: EntryType; userId?: string }): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    const parsed = dayStatusSchema.safeParse(input);
    if (!parsed.success) return fail((await getTranslations("myTime.server"))("pickStatus"));
    const userId = targetUser(actor, parsed.data.userId);
    if (!userId) return fail((await getTranslations("errors"))("forbidden"));
    await setDayStatus(actor, userId, parsed.data.date, parsed.data.status);
    refresh();
    return ok();
  } catch (err) {
    return actionError(err);
  }
}
